/*
 * 各菜单视图组件。
 *
 * 每个组件都是 { props/状态, 方法, template } 的对象，
 * template 用普通字符串（不套反引号），从 window.CHART_TPL 里取，
 * 这样就避开了「模板字符串里再嵌反引号」这个把编译搞炸的写法。
 */
const VRef = Vue.ref;
const VReactive = Vue.reactive;
const VMounted = Vue.onMounted;
const VWatch = Vue.watch;
const VNextTick = Vue.nextTick;
const VComputed = Vue.computed;
const VUnmounted = Vue.onBeforeUnmount;

/* 把带缩进的模板文本转成单行拼接，避免反引号嵌套 */
function tpl(str) {
    return str.trim();
}

/* 当前时间 HH:MM:SS，补日志时间戳用 */
function now() {
    const d = new Date();
    const p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

/* ==========================================================
 * 1. 分析看板
 * ========================================================== */
window.DashboardView = {
    setup() {
        const stats = VRef({});
        const loading = VRef(false);
        const priceChart = window.vbarChart({});
        const brandChart = window.barChart({ limit: 10, color: '#67c23a' });
        const discountChart = window.vbarChart({ color: '#e6a23c' });
        const categoryChart = window.pieChart({});
        const trendChart = window.lineChart({});

        async function load() {
            loading.value = true;
            try {
                const d = await API.dashboard();
                if (!d) return;
                stats.value = d.overview || {};
                priceChart.render(d.price_distribution, 'count', 'band');
                brandChart.render(d.brand_ranking, 'count', 'brand_name');
                discountChart.render(d.discount_distribution, 'count', 'band');
                categoryChart.render(d.category_distribution, 'count', 'name');
                trendChart.render(d.daily_trend, 'count', 'day');
            } catch (e) { /* 已弹错 */ } finally {
                loading.value = false;
            }
        }
        VMounted(load);

        return { stats, loading, load, priceChart, brandChart, discountChart, categoryChart, trendChart, fmtMoney: window.fmtMoney };
    },
    template: tpl(`
<div v-loading="loading" class="view">
  <div class="page-head">
    <h2>分析看板</h2>
    <el-button @click="load">刷新</el-button>
  </div>

  <div class="stat-row">
    <el-card shadow="hover" class="stat-card">
      <div class="stat-num">{{ stats.total || 0 }}</div><div class="stat-lb">商品总数</div>
    </el-card>
    <el-card shadow="hover" class="stat-card">
      <div class="stat-num">{{ stats.brand_count || 0 }}</div><div class="stat-lb">品牌数</div>
    </el-card>
    <el-card shadow="hover" class="stat-card">
      <div class="stat-num">{{ stats.category_count || 0 }}</div><div class="stat-lb">类目数</div>
    </el-card>
    <el-card shadow="hover" class="stat-card">
      <div class="stat-num">{{ fmtMoney(stats.avg_price) }}</div><div class="stat-lb">均价</div>
    </el-card>
    <el-card shadow="hover" class="stat-card">
      <div class="stat-num">{{ fmtMoney(stats.max_price) }}</div><div class="stat-lb">最高价</div>
    </el-card>
    <el-card shadow="hover" class="stat-card">
      <div class="stat-num">{{ fmtMoney(stats.min_price) }}</div><div class="stat-lb">最低价</div>
    </el-card>
  </div>

  <el-row :gutter="12">
    <el-col :span="12"><el-card shadow="never"><template #header>价格带分布</template><div :ref="el => priceChart.bind(el)" class="chart"></div></el-card></el-col>
    <el-col :span="12"><el-card shadow="never"><template #header>折扣力度分布</template><div :ref="el => discountChart.bind(el)" class="chart"></div></el-card></el-col>
  </el-row>
  <el-row :gutter="12">
    <el-col :span="12"><el-card shadow="never"><template #header>品牌 TOP10</template><div :ref="el => brandChart.bind(el)" class="chart"></div></el-card></el-col>
    <el-col :span="12"><el-card shadow="never"><template #header>类目占比</template><div :ref="el => categoryChart.bind(el)" class="chart"></div></el-card></el-col>
  </el-row>
  <el-row :gutter="12">
    <el-col :span="24"><el-card shadow="never"><template #header>近 14 天上新趋势</template><div :ref="el => trendChart.bind(el)" class="chart"></div></el-card></el-col>
  </el-row>
</div>
`),
};

/* ==========================================================
 * 2. 商品排行
 * ========================================================== */
window.RankingView = {
    setup() {
        const rows = VRef([]);
        const loading = VRef(false);
        const chart = window.barChart({ limit: 15, color: '#f56c6c' });

        async function load() {
            loading.value = true;
            try {
                rows.value = await API.analysisRanking({ limit: 20 }) || [];
                chart.render(rows.value, 'price', 'brand_name');
            } catch (e) { /* 已弹错 */ } finally {
                loading.value = false;
            }
        }

        function exportCsv() {
            window.downloadCsv({ ordering: '-price' });
        }

        VMounted(load);
        return { rows, loading, load, chart, exportCsv, fmtMoney: window.fmtMoney };
    },
    template: tpl(`
<div v-loading="loading" class="view">
  <div class="page-head">
    <h2>商品排行</h2>
    <div>
      <el-button @click="load">刷新</el-button>
      <el-button type="primary" @click="exportCsv">导出 CSV</el-button>
    </div>
  </div>
  <el-card shadow="never">
    <el-table :data="rows" border stripe>
      <el-table-column type="index" label="#" width="55" />
      <el-table-column label="商品" min-width="300">
        <template #default="s">
          <div class="cell-title">{{ s.row.title }}</div>
          <div class="cell-sub">{{ s.row.brand_name }} · {{ s.row.keyword }}</div>
        </template>
      </el-table-column>
      <el-table-column label="售价" width="110" sortable :sort-by="r => r.price">
        <template #default="s">{{ fmtMoney(s.row.price) }}</template>
      </el-table-column>
      <el-table-column label="原价" width="110">
        <template #default="s">{{ fmtMoney(s.row.market_price) }}</template>
      </el-table-column>
      <el-table-column label="折扣" width="90">
        <template #default="s">
          <span v-if="s.row.discount">{{ (s.row.discount * 10).toFixed(1) }}折</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-card shadow="never" style="margin-top:12px">
    <template #header>品牌售价 TOP15（条长 = 售价）</template>
    <div :ref="el => chart.bind(el)" class="chart"></div>
  </el-card>
</div>
`),
};

/* ==========================================================

/* ==========================================================
 * 3. 商品管理（完整 CRUD）
 * ========================================================== */
window.ProductView = {
    setup() {
        const rows = VRef([]);
        const total = VRef(0);
        const loading = VRef(false);
        const sel = VRef([]);

        // ---------- 筛选条件 ----------
        // 价格初值必须是 null：写 undefined 会被 Element 兜成 0，
        // 后端拿到 0 就变成「只看 0 元商品」，列表直接空掉（踩过一次）
        const q = VReactive({
            q: '', brand: '', category: '', keyword: '', status: '',
            price_min: null, price_max: null, ordering: '-id', page: 1, size: 20,
        });

        // 下拉选项，从维度接口拿，避免手输错字
        const brands = VRef([]);
        const categories = VRef([]);
        const sources = VRef([]);

        // ---------- 新增 / 编辑对话框 ----------
        const dialog = VRef(false);
        const saving = VRef(false);
        const mode = VRef('create');          // create | edit

        // 表单每种字段的「空值」不一样：
        // 数字类要 null（传 0 会被后端当成「价格为 0」），
        // 文本类要空串，status 要 1（在售），is_recommend 要 false。
        // 用一张表写死，别再套嵌套三元了 —— 上次套完自己都看不明白。
        const EMPTY_DEF = {
            id: null, title: '', sub_title: '', brand_name: '', category_name: '',
            price: null, market_price: null, sales: '', stock: null,
            image: '', url: '', keyword: '', source_id: null,
            status: 1, is_recommend: false,
        };

        const form = VReactive(Object.assign({}, EMPTY_DEF));

        // ---------- 详情抽屉 ----------
        const drawer = VRef(false);
        const detail = VRef(null);

        // ---------- 批量设置关键词 ----------
        const batchKw = VRef('');

        // ---------- 上传导入 ----------
        const imp = VReactive({
            visible: false, file: null, fileName: '',
            update: true, loading: false,
            result: null, error: '',
        });

        function openImport() {
            imp.file = null;
            imp.fileName = '';
            imp.result = null;
            imp.error = '';
            imp.visible = true;
        }

        // el-upload 的 file 是原始 File 对象，取出来交给 API.productImport
        function onFileChange(f) {
            const raw = f.raw || f;
            if (!raw) return;
            // 前端先卡一道大小，省得 20MB 的文件传半天才被后端拒
            if (raw.size / 1024 / 1024 > 20) {
                imp.error = '文件超过 20 MB，请拆分后再上传';
                imp.file = null;
                imp.fileName = '';
                return;
            }
            imp.file = raw;
            imp.fileName = raw.name;
            imp.error = '';
        }

        async function doImport() {
            if (!imp.file) return toast('请先选择文件', 'warn');
            imp.loading = true;
            imp.result = null;
            imp.error = '';
            try {
                const d = await API.productImport(imp.file, imp.update);
                imp.result = d;
                toast('导入完成：新增 ' + d.created + '，更新 ' + d.updated
                      + '，失败 ' + d.failed_count);
                load();
            } catch (e) {
                // 后端把失败明细放在 payload 里，一并展示，
                // 别让用户只看到一句「导入失败」
                if (e.payload && e.payload.data) {
                    imp.result = e.payload.data;
                }
                imp.error = e.message || '导入失败';
            } finally {
                imp.loading = false;
            }
        }

        function downloadTemplate() {
            window.location.href = API.importTemplateUrl;
        }

        // ---------- 加载 ----------
        async function load() {
            loading.value = true;
            try {
                const d = await API.products({
                    q: q.q, brand_name: q.brand, category_name: q.category,
                    keyword: q.keyword, status: q.status,
                    price_min: q.price_min, price_max: q.price_max,
                    ordering: q.ordering, page: q.page, page_size: q.size,
                });
                rows.value = d.items || [];
                total.value = d.total || 0;
            } catch (e) { /* 已弹错 */ } finally {
                loading.value = false;
            }
        }

        async function loadOptions() {
            try {
                const [b, c, s] = await Promise.all([
                    API.brands(), API.categories(), API.sources({ page_size: 50 }),
                ]);
                brands.value = (b.items || []).map(x => x.name);
                categories.value = (c.items || []).map(x => x.name);
                sources.value = (s.items || []).map(x => ({ id: x.id, name: x.name }));
            } catch (e) { /* 已弹错 */ }
        }

        function reset() {
            q.q = ''; q.brand = ''; q.category = ''; q.keyword = '';
            q.status = ''; q.price_min = null; q.price_max = null; q.page = 1;
            load();
        }

        const EMPTY = EMPTY_DEF;

        // ---------- 新增 ----------
        function openCreate() {
            mode.value = 'create';
            // 逐字段赋空值而不是整个替换对象：reactive 对象替换会丢响应式链接
            Object.keys(EMPTY).forEach(function (k) { form[k] = EMPTY[k]; });
            dialog.value = true;
        }

        // ---------- 编辑 ----------
        // 后端 _money() 把 Decimal 转成了 float（JSON 里不带引号），
        // 于是 "299.00" 变成 299.0，直接塞进输入框会显示成 299，少了小数位。
        // 这里补回两位小数再回显，让用户看到的和库里存的一致。
        function toNumStr(v) {
            if (v === null || v === undefined || v === '') return null;
            const n = Number(v);
            return isNaN(n) ? String(v) : n.toFixed(2);
        }

        // 整数类字段原样转字符串，别套 toFixed（88 会变成 88.00）
        function toIntStr(v) {
            if (v === null || v === undefined || v === '') return null;
            return String(v);
        }

        function openEdit(row) {
            mode.value = 'edit';
            Object.keys(EMPTY).forEach(function (k) { form[k] = EMPTY[k]; });
            form.id = row.id;
            form.title = row.title || '';
            form.sub_title = row.sub_title || '';
            form.brand_name = row.brand_name || '';
            form.category_name = row.category_name || '';
            form.price = toNumStr(row.price);
            form.market_price = toNumStr(row.market_price);
            form.sales = toIntStr(row.sales);
            form.stock = toIntStr(row.stock);
            form.image = row.image || '';
            form.url = row.url || '';
            form.keyword = row.keyword || '';
            form.source_id = row.source_id || null;
            form.status = row.status;
            form.is_recommend = !!row.is_recommend;
            dialog.value = true;
        }

        async function save() {
            if (!form.title.trim()) return toast('请填写商品名称', 'warn');

            // 价格当场验一遍。后端 _clean_decimal 对非法文本的处理是「转成 None」，
            // 也就是说用户打错一个字，售价会静默变空 —— 数据没了还不知道为什么。
            // 所以这里先把话说在前头。
            for (const [label, val] of [['售价', form.price], ['原价', form.market_price]]) {
                if (val === null || val === undefined || String(val).trim() === '') continue;
                if (!/^\d+(\.\d{1,2})?$/.test(String(val).trim())) {
                    return toast(label + '请填数字，最多两位小数（当前填的是「' + val + '」）', 'warn');
                }
            }

            saving.value = true;
            try {
                if (mode.value === 'create') {
                    await API.productCreate(form);
                    toast('已新增商品');
                } else {
                    await API.productUpdate(form.id, form);
                    toast('已保存修改');
                }
                dialog.value = false;
                // 新增后跳回第一页，不然新商品不在当前页看着像没保存成功
                if (mode.value === 'create') q.page = 1;
                load();
            } catch (e) { /* 已弹错 */ } finally {
                saving.value = false;
            }
        }

        // ---------- 详情 ----------
        async function openDetail(row) {
            detail.value = row;
            drawer.value = true;
            try {
                const d = await API.productDetail(row.id);
                detail.value = d;
            } catch (e) { /* 已弹错 */ }
        }

        // ---------- 复制 ----------
        async function duplicate(row) {
            try {
                const d = await API.productCopy(row.id);
                toast('已复制，可直接编辑');
                // 复制件紧挨着原记录，直接开编辑框最顺手
                load();
                openEdit({
                    id: d.id, title: d.title, sub_title: d.sub_title,
                    brand_name: d.brand_name, category_name: d.category_name,
                    price: d.price, market_price: d.market_price,
                    sales: d.sales, stock: d.stock, image: d.image,
                    url: d.url, keyword: d.keyword, status: d.status,
                    is_recommend: d.is_recommend,
                });
            } catch (e) { /* 已弹错 */ }
        }

        // ---------- 单条上下架 ----------
        async function toggleStatus(row) {
            try {
                await API.productUpdate(row.id, { status: row.status === 1 ? 0 : 1 });
                toast(row.status === 1 ? '已下架' : '已上架');
                load();
            } catch (e) { /* 已弹错 */ }
        }

        async function toggleRecommend(row) {
            try {
                await API.productUpdate(row.id, { is_recommend: !row.is_recommend });
                toast(row.is_recommend ? '已取消推荐' : '已标为重点推荐');
                load();
            } catch (e) { /* 已弹错 */ }
        }

        // ---------- 删除 ----------
        async function remove(row) {
            await ElementPlus.ElMessageBox.confirm(
                '确定删除「' + (row.title || '').slice(0, 24) + '」？删除后不可恢复。',
                '确认删除', { type: 'warning' });
            try {
                await API.productDelete(row.id);
                toast('已删除');
                // 删掉当前页最后一条时回退一页，不然停在空白页
                if (rows.value.length === 1 && q.page > 1) q.page -= 1;
                load();
            } catch (e) { /* 已弹错 */ }
        }

        // ---------- 批量操作 ----------
        async function batchUpdate(payload, label) {
            if (!sel.value.length) return toast('请先选择商品', 'warn');
            try {
                await API.productBatchUpdate(Object.assign({
                    ids: sel.value.map(function (r) { return r.id; }),
                }, payload));
                toast('已' + label + ' ' + sel.value.length + ' 个商品');
                sel.value = [];
                load();
            } catch (e) { /* 已弹错 */ }
        }

        function batchOnSale() { batchUpdate({ status: 1, action: '上架' }, '上架'); }
        function batchOffSale() { batchUpdate({ status: 0, action: '下架' }, '下架'); }
        function batchRec() { batchUpdate({ is_recommend: true, action: '标记推荐' }, '标记推荐'); }
        function batchUnrec() { batchUpdate({ is_recommend: false, action: '取消推荐' }, '取消推荐'); }

        function batchKeyword() {
            if (!batchKw.value.trim()) return toast('请先填写关键词', 'warn');
            batchUpdate({ keyword: batchKw.value.trim(), action: '打标签' }, '打标签');
            batchKw.value = '';
        }

        async function batchRemove() {
            if (!sel.value.length) return toast('请先选择商品', 'warn');
            const n = sel.value.length;
            await ElementPlus.ElMessageBox.confirm(
                '确定删除选中的 ' + n + ' 条商品？删除后不可恢复。',
                '批量删除', { type: 'warning' });
            try {
                await API.productBatchDelete(sel.value.map(function (r) { return r.id; }));
                toast('已删除 ' + n + ' 个商品');
                sel.value = [];
                // 选中的比当前页还多时（跨页勾选），删完当前页会空掉，得回退
                if (n >= rows.value.length && q.page > 1) q.page -= 1;
                load();
            } catch (e) { /* 已弹错 */ }
        }

        function exportCsv() {
            window.downloadCsv({
                q: q.q, brand_name: q.brand, category_name: q.category,
                keyword: q.keyword, status: q.status,
                price_min: q.price_min, price_max: q.price_max,
            });
        }

        // 售价/原价填了就实时算折扣给用户看，后端还会再算一次（两边口径一致）
        const discountHint = VComputed(function () {
            const p = form.price, m = form.market_price;
            if (p === null || m === null || p === undefined || m === undefined) return '';
            if (!m || m <= 0) return '原价必须大于 0';
            const d = p / m;
            return '折扣力度 ' + d.toFixed(2) + '（约 ' + (d * 10).toFixed(1) + ' 折）';
        });

        const selectedIds = VComputed(function () {
            return sel.value.map(function (r) { return r.id; });
        });

        VMounted(function () { load(); loadOptions(); });

        return {
            rows, total, loading, sel, q, brands, categories, sources,
            dialog, saving, mode, form, discountHint,
            drawer, detail, batchKw, selectedIds,
            imp, openImport, onFileChange, doImport, downloadTemplate,
            load, reset,
            openCreate, openEdit, save, openDetail, duplicate,
            toggleStatus, toggleRecommend, remove,
            batchOnSale, batchOffSale, batchRec, batchUnrec, batchKeyword, batchRemove,
            exportCsv, fmtMoney: window.fmtMoney,
        };
    },

    template: tpl(`
<div v-loading="loading" class="view">
  <div class="page-head">
    <h2>商品管理</h2>
    <div>
      <el-button type="primary" @click="openCreate">新增商品</el-button>
      <el-button @click="openImport">上传导入</el-button>
      <el-button @click="load">刷新</el-button>
      <el-button @click="reset">重置</el-button>
      <el-button type="primary" plain @click="exportCsv">导出 CSV</el-button>
    </div>
  </div>

  <el-card shadow="never">
    <div class="toolbar">
      <el-input v-model="q.q" placeholder="商品名/品牌关键词" style="width:200px" clearable
                @keyup.enter="q.page = 1; load()" />
      <el-select v-model="q.brand" placeholder="品牌" style="width:150px" clearable filterable allow-create>
        <el-option v-for="b in brands" :key="b" :value="b" :label="b" />
      </el-select>
      <el-select v-model="q.category" placeholder="类目" style="width:140px" clearable filterable allow-create>
        <el-option v-for="c in categories" :key="c" :value="c" :label="c" />
      </el-select>
      <el-input v-model="q.keyword" placeholder="采集关键词" style="width:140px" clearable />
      <el-select v-model="q.status" placeholder="状态" style="width:110px" clearable>
        <el-option label="在售" :value="1" />
        <el-option label="已下架" :value="0" />
      </el-select>
      <el-input-number v-model="q.price_min" :min="0" :controls="false"
                       placeholder="最低价" style="width:88px" />
      <span class="hint">-</span>
      <el-input-number v-model="q.price_max" :min="0" :controls="false"
                       placeholder="最高价" style="width:88px" />
      <el-select v-model="q.ordering" style="width:140px">
        <el-option label="最新入库" value="-id" />
        <el-option label="价格从高到低" value="-price" />
        <el-option label="价格从低到高" value="price" />
        <el-option label="折扣力度从低到高" value="discount" />
        <el-option label="折扣力度从高到低" value="-discount" />
      </el-select>
      <el-button type="primary" @click="q.page = 1; load()">查询</el-button>
    </div>

    <!-- 批量操作条：只在有勾选时出现 -->
    <div v-if="sel.length" class="batch-bar">
      <span class="hint">已选 <strong>{{ sel.length }}</strong> 项</span>
      <el-button size="small" @click="batchOnSale">批量上架</el-button>
      <el-button size="small" @click="batchOffSale">批量下架</el-button>
      <el-button size="small" @click="batchRec">标记推荐</el-button>
      <el-button size="small" @click="batchUnrec">取消推荐</el-button>
      <el-input v-model="batchKw" size="small" placeholder="批量打采集关键词"
                style="width:180px" clearable />
      <el-button size="small" @click="batchKeyword">应用标签</el-button>
      <div class="spacer"></div>
      <el-button size="small" type="danger" @click="batchRemove">批量删除</el-button>
    </div>

    <el-table :data="rows" border stripe @selection-change="sel = $event">
      <el-table-column type="selection" width="45" />
      <el-table-column label="商品" min-width="300">
        <template #default="s">
          <div class="cell-title">
            <el-image v-if="s.row.image" :src="s.row.image"
                      class="cell-img" fit="cover"
                      :preview-src-list="[s.row.image]" preview-teleported />
            <span class="cell-title-text">{{ s.row.title }}</span>
          </div>
          <div class="cell-sub">
            ID {{ s.row.id }}
            <template v-if="s.row.brand_name"> · {{ s.row.brand_name }}</template>
            <template v-if="s.row.keyword"> · 来自「{{ s.row.keyword }}」</template>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="售价" width="95">
        <template #default="s">{{ fmtMoney(s.row.price) }}</template>
      </el-table-column>
      <el-table-column label="原价" width="95">
        <template #default="s">{{ fmtMoney(s.row.market_price) }}</template>
      </el-table-column>
      <el-table-column label="折扣" width="85">
        <template #default="s">
          <el-tag v-if="s.row.discount" size="small" type="danger">
            {{ (s.row.discount * 10).toFixed(1) }}折
          </el-tag>
          <span v-else class="hint">-</span>
        </template>
      </el-table-column>
      <el-table-column label="销量/库存" width="95">
        <template #default="s">{{ s.row.sales }} / {{ s.row.stock === null ? '-' : s.row.stock }}</template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="s">
          <el-tag :type="s.row.status === 1 ? 'success' : 'info'" size="small" effect="plain">
            {{ s.row.status === 1 ? '在售' : '已下架' }}
          </el-tag>
          <el-tag v-if="s.row.is_recommend" type="warning" size="small" effect="dark">荐</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="来源" width="105" prop="source_name" />
      <el-table-column label="操作" width="215" fixed="right">
        <template #default="s">
          <el-button link type="primary" @click="openDetail(s.row)">详情</el-button>
          <el-button link type="primary" @click="openEdit(s.row)">编辑</el-button>
          <el-button link @click="duplicate(s.row)">复制</el-button>
          <el-button link type="warning" @click="toggleStatus(s.row)">
            {{ s.row.status === 1 ? '下架' : '上架' }}
          </el-button>
          <el-button link type="danger" @click="remove(s.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination class="pager"
      layout="total, sizes, prev, pager, next, jumper"
      :total="total" :page-size="q.size" :current-page="q.page"
      :page-sizes="[20, 50, 100, 200]"
      @current-change="v => { q.page = v; load(); }"
      @size-change="v => { q.size = v; q.page = 1; load(); }" />
  </el-card>

  <!-- ============ 新增 / 编辑对话框 ============ -->
  <el-dialog v-model="dialog" :title="mode === 'create' ? '新增商品' : '编辑商品'"
             width="760px" top="6vh" destroy-on-close>
    <el-form label-width="96px" size="small">
      <el-row :gutter="12">
        <el-col :span="24">
          <el-form-item label="商品名称" required>
            <el-input v-model="form.title" placeholder="必填" maxlength="300" show-word-limit />
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item label="副标题">
            <el-input v-model="form.sub_title" placeholder="选填" maxlength="300" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="品牌">
            <el-select v-model="form.brand_name" style="width:100%" clearable
                       filterable allow-create default-first-option
                       placeholder="可下拉选，也可直接输入新品牌">
              <el-option v-for="b in brands" :key="b" :value="b" :label="b" />
            </el-select>
            <p class="hint">库里有 {{ brands.length }} 个品牌，直接下拉选即可</p>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="类目">
            <el-select v-model="form.category_name" style="width:100%" clearable
                       filterable allow-create default-first-option
                       placeholder="可下拉选，也可直接输入新类目">
              <el-option v-for="c in categories" :key="c" :value="c" :label="c" />
            </el-select>
            <p class="hint">库里有 {{ categories.length }} 个类目</p>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="售价">
            <el-input v-model="form.price" placeholder="选填" />
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="原价">
            <el-input v-model="form.market_price" placeholder="选填" />
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="销量">
            <el-input v-model="form.sales" placeholder="选填" />
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="库存">
            <el-input v-model="form.stock" placeholder="选填" />
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item label="折扣">
            <el-input :model-value="discountHint || '填写售价与原价后自动计算，无需手填'"
                      readonly placeholder="自动计算" />
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item label="主图地址">
            <el-input v-model="form.image" placeholder="https://…  留空则列表不显示缩略图" />
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item label="商品链接">
            <el-input v-model="form.url" placeholder="https://…" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="采集关键词">
            <el-input v-model="form.keyword" placeholder="选填" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="来源">
            <el-select v-model="form.source_id" style="width:100%" clearable placeholder="手工新增留空">
              <el-option v-for="s in sources" :key="s.id" :value="s.id" :label="s.name" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="状态">
            <el-switch v-model="form.status" :active-value="1" :inactive-value="0"
                       active-text="在售" inactive-text="下架" />
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item label="推荐">
            <el-switch v-model="form.is_recommend" active-text="标为重点推荐" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-alert v-if="mode === 'edit'" type="warning" :closable="false"
        title="抓取来的商品若被重新采集，会覆盖你在这里改过的字段。要长期保留修改，建议先复制成新商品再编辑。" />
    </el-form>
    <template #footer>
      <el-button @click="dialog = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">
        {{ mode === 'create' ? '确认新增' : '保存修改' }}
      </el-button>
    </template>
  </el-dialog>

  <!-- ============ 上传导入 ============ -->
  <el-dialog v-model="imp.visible" title="上传导入商品" width="640px">
    <el-alert type="info" :closable="false" style="margin-bottom:14px">
      <template #title>
        支持 CSV 与 Excel(xlsx)。表头只要含「商品名称」列就能导入，
        其余列名很宽松（品牌 / brand_name / Brand Name 都能认）。
      </template>
    </el-alert>

    <div class="imp-row">
      <el-upload :auto-upload="false" :limit="1" :show-file-list="false"
                 accept=".csv,.xlsx,.xlsm" :on-change="onFileChange">
        <el-button type="primary" plain>选择文件</el-button>
      </el-upload>
      <span v-if="imp.fileName" class="hint">已选：{{ imp.fileName }}</span>
      <span v-else class="hint">未选择文件</span>
      <div class="spacer"></div>
      <el-button link type="primary" @click="downloadTemplate">下载导入模板</el-button>
    </div>

    <el-form label-width="90px" size="small" style="margin-top:14px">
      <el-form-item label="重复处理">
        <el-switch v-model="imp.update" />
        <span class="hint">
          {{ imp.update
            ? '按商品ID或「商品名+品牌」覆盖已有记录（推荐，重复上传不会翻倍）'
            : '一律新增（重复上传会产生重复商品）' }}
        </span>
      </el-form-item>
    </el-form>

    <el-alert v-if="imp.error" type="error" :closable="false"
              :title="imp.error" style="margin-bottom:12px" />

    <div v-if="imp.result" class="imp-result">
      <div class="imp-stat">
        <span>新增 <strong>{{ imp.result.created }}</strong></span>
        <span>更新 <strong>{{ imp.result.updated }}</strong></span>
        <span :class="imp.result.failed_count ? 'err' : ''">
          失败 <strong>{{ imp.result.failed_count }}</strong>
        </span>
        <span>共 {{ imp.result.total_rows }} 行</span>
      </div>
      <el-table v-if="imp.result.failed && imp.result.failed.length"
                :data="imp.result.failed" border size="small" max-height="200">
        <el-table-column prop="row" label="行号" width="70" align="center" />
        <el-table-column prop="title" label="商品名称" min-width="180"
                         show-overflow-tooltip />
        <el-table-column prop="reason" label="失败原因" min-width="200"
                         show-overflow-tooltip />
      </el-table>
      <p v-if="imp.result.failed_count > imp.result.failed.length" class="hint">
        仅显示前 {{ imp.result.failed.length }} 条失败记录，共
        {{ imp.result.failed_count }} 条。
      </p>
    </div>

    <template #footer>
      <el-button @click="imp.visible = false">关闭</el-button>
      <el-button type="primary" :loading="imp.loading" :disabled="!imp.file"
                 @click="doImport">
        {{ imp.loading ? '导入中…' : '开始导入' }}
      </el-button>
    </template>
  </el-dialog>

  <!-- ============ 详情抽屉 ============ -->
  <el-drawer v-model="drawer" title="商品详情" size="620px">
    <div v-if="detail" class="detail">
      <div class="detail-head">
        <el-image v-if="detail.image" :src="detail.image" class="detail-img"
                  fit="cover" :preview-src-list="[detail.image]" preview-teleported />
        <div>
          <h3 class="detail-title">{{ detail.title }}</h3>
          <p v-if="detail.sub_title" class="hint">{{ detail.sub_title }}</p>
          <el-tag :type="detail.status === 1 ? 'success' : 'info'" size="small" effect="plain">
            {{ detail.status === 1 ? '在售' : '已下架' }}
          </el-tag>
          <el-tag v-if="detail.is_recommend" type="warning" size="small" effect="dark">重点推荐</el-tag>
        </div>
      </div>

      <el-descriptions :column="2" border size="small" class="detail-desc">
        <el-descriptions-item label="商品 ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="售价">{{ fmtMoney(detail.price) }}</el-descriptions-item>
        <el-descriptions-item label="原价">{{ fmtMoney(detail.market_price) }}</el-descriptions-item>
        <el-descriptions-item label="折扣">
          {{ detail.discount ? (detail.discount * 10).toFixed(1) + ' 折' : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="品牌">{{ detail.brand_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="类目">{{ detail.category_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="销量">{{ detail.sales }}</el-descriptions-item>
        <el-descriptions-item label="库存">{{ detail.stock === null ? '-' : detail.stock }}</el-descriptions-item>
        <el-descriptions-item label="采集关键词">{{ detail.keyword || '-' }}</el-descriptions-item>
        <el-descriptions-item label="数据来源">{{ detail.source_name || '手工新增' }}</el-descriptions-item>
        <el-descriptions-item label="浏览量">{{ detail.view_count }}</el-descriptions-item>
        <el-descriptions-item label="上架时间">{{ detail.listed_at || '-' }}</el-descriptions-item>
        <el-descriptions-item label="SPU_ID">{{ detail.spu_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="GOODS_ID">{{ detail.goods_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="入库时间">{{ detail.create_time }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ detail.update_time }}</el-descriptions-item>
        <el-descriptions-item label="商品链接" :span="2">
          <a v-if="detail.url" :href="detail.url" target="_blank" rel="noopener"
             class="ai-link">{{ detail.url }}</a>
          <span v-else>-</span>
        </el-descriptions-item>
      </el-descriptions>
    </div>
    <template #footer>
      <el-button @click="drawer = false">关闭</el-button>
      <el-button type="primary" @click="drawer = false; openEdit(detail)">编辑此商品</el-button>
    </template>
  </el-drawer>
</div>
`),
};

/* ==========================================================
 * 4. 数据采集
 * ========================================================== */
window.CrawlView = {
    setup() {
        const form = VReactive({ keyword: '连衣裙', pages: 60 });
        const probing = VRef(false);
        const results = VRef([]);
        const runs = VRef([]);
        const logs = VRef([]);
        const st = VReactive({ status: 'idle', fetched: 0, total: null,
                              inserted: 0, updated: 0, target: 0, error: '' });
        let seq = 0;          // 已拉到的日志序号，下次只拉增量
        let timer = 0;        // 轮询定时器

        const busy = VComputed(function () {
            return st.status === 'running' || st.status === 'saving';
        });

        // 日志文本在这里拼好，不在模板里写 join('\n')
        //
        // 血泪坑：模板是反引号字符串，'\n' 会被 JS 先解析成真换行，
        // Vue 模板里就出现一个裸换行符 -> compiler-38「Invalid or unexpected token」
        // -> 整个 CrawlView 编译失败 -> 页面白屏，而且后面几个页面被连锁带崩。
        const logText = VComputed(function () {
            if (!logs.value.length) return '（暂无日志，点「开始采集」看实时进度）';
            return logs.value.map(function (l) { return l.t + '  ' + l.m; }).join('\n');
        });

        const statusText = VComputed(function () {
            return {
                idle: '空闲', running: '抓取中（边抓边存）', saving: '入库中…',
                done: '已完成', failed: '失败'
            }[st.status] || st.status;
        });

        function addLine(l) {
            logs.value.push(l);
            if (logs.value.length > 500) logs.value.splice(0, 100);
        }

        // ---------- 轮询状态 ----------
        async function poll() {
            try {
                const d = await API.crawlStatus({ since: seq });
                Object.assign(st, d);
                (d.logs || []).forEach(addLine);
                if (d.logs && d.logs.length) seq = d.seq;
                if (st.status === 'done' || st.status === 'failed') {
                    loadRuns();
                }
            } catch (e) { /* 已弹错 */ }
        }

        async function startCrawl() {
            logs.value = [];
            seq = 0;
            try {
                const d = await API.crawlStart({ keyword: form.keyword, pages: form.pages });
                Object.assign(st, d);
                toast(d.msg || '采集已启动');
                poll();
            } catch (e) {
                // 已经有任务在跑时后端返回 code=1，这里只补一行日志
                addLine({ t: now(), m: '启动失败：' + e.message });
            }
        }

        async function stopCrawl() {
            try {
                const d = await API.crawlStop();
                Object.assign(st, d);
                toast(d.msg || '已请求停止');
            } catch (e) { /* 已弹错 */ }
        }

        async function probe() {
            probing.value = true;
            results.value = [];
            try {
                const d = await API.vipProbe({ keyword: form.keyword });
                results.value = d.results || (Array.isArray(d) ? d : []);
                addLine({ t: now(), m: '接口探测完成' });
            } catch (e) {
                addLine({ t: now(), m: '探测失败：' + e.message });
            } finally { probing.value = false; }
        }

        async function loadRuns() {
            try {
                const d = await API.runs({ page: 1, page_size: 20 });
                runs.value = d.items || [];
            } catch (e) { /* 已弹错 */ }
        }

        function exportCsv() {
            window.downloadCsv({ keyword: form.keyword });
        }

        // 模板里不能直接写 window.xxx（Vue 表达式求值时 window 不可见），要包一层
        function exportAll() {
            window.downloadCsv({});
        }

        // ---------- 浏览器环境（换电脑排查 + 显示隐藏） ----------
        const br = VReactive({ loading: false, saving: false, found: false,
                               path: '', source: '', mode: 'hidden',
                               modeLabel: '', modes: [], profile: '',
                               running: false, version: '', candidates: [],
                               configFile: '', customPath: '',
                               diagnosing: false, diagnostic: '' });

        async function loadBrowser() {
            br.loading = true;
            try {
                const d = await API.browser();
                Object.assign(br, d);
                if (!br.customPath) br.customPath = br.path || '';
            } catch (e) { /* 已弹错 */ }
            finally { br.loading = false; }
        }

        async function setMode(mode) {
            try {
                const d = await API.browserMode(mode);
                br.mode = d.mode;
                br.modeLabel = d.mode_label;
                toast(d.message || '已切换');
            } catch (e) { /* 已弹错 */ }
        }

        async function saveBrowserPath() {
            if (!br.customPath) { toast('请先填写浏览器路径', 'warning'); return; }
            br.saving = true;
            try {
                const d = await API.browserSelect(br.customPath);
                br.path = d.path;
                toast(d.message || '已保存', 'success');
                loadBrowser();
            } catch (e) { /* 已弹错 */ }
            finally { br.saving = false; }
        }

        // 浏览器定位的纯文本诊断，直接贴在页面上给用户看
        async function diagnose() {
            br.diagnosing = true;
            br.diagnostic = '正在扫描常见安装位置…';
            try {
                const d = await API.browser();
                Object.assign(br, d);
                let s = '最终选用：' + (d.path || '（未找到）') + '\n\n';
                if (d.candidates && d.candidates.length) {
                    s += '发现 ' + d.candidates.length + ' 个可用浏览器：\n';
                    d.candidates.forEach(function (c) {
                        s += '  · ' + c.path + '\n      来源：' + c.source + '\n';
                    });
                } else {
                    s += '没找到 msedge.exe / chrome.exe。\n\n'
                       + '解决办法（任选一种）：\n'
                       + '  1) 安装 Edge：https://www.microsoft.com/edge\n'
                       + '  2) 在左侧「浏览器路径」里手填完整路径\n'
                       + '  3) 设置环境变量后重启程序：\n'
                       + '     set VIP_BROWSER_PATH=C:\\...\\chrome.exe\n\n'
                       + '配置文件位置：' + (d.config_file || '');
                }
                br.diagnostic = s;
            } catch (e) {
                br.diagnostic = '诊断失败：' + e.message;
            }
            finally { br.diagnosing = false; }
        }

        const browserSummary = VComputed(function () {
            if (br.loading) return '正在检测…';
            if (!br.found) return '未找到浏览器 —— 采集不可用，请点「诊断」';
            return (br.version || '浏览器') + ' · ' + br.modeLabel
                 + (br.running ? ' · 运行中' : '');
        });

        VMounted(function () {
            poll();
            loadRuns();
            loadBrowser();
            // 无条件轮询，别用 busy 当开关
            //
            // 血泪坑：之前写成 `if (busy) poll()`，结果点「开始采集」后
            // 第一轮 poll 恰好赶在后台线程 set_status 之前，读到 idle，
            // 于是判定「不忙」-> 定时器再也不问了 -> 页面永远停在「空闲」，
            // 而后端其实抓得好好的。一秒一次的开销可以忽略，别省这点事。
            timer = window.setInterval(poll, 1000);
        });
        VUnmounted(function () { if (timer) window.clearInterval(timer); });

        return {
            form, probing, results, runs, logs, st, busy, logText, statusText,
            startCrawl, stopCrawl, probe, loadRuns, exportCsv, exportAll,
            br, loadBrowser, setMode, saveBrowserPath, diagnose, browserSummary,
            fmtMoney: window.fmtMoney,
        };
    },
    template: tpl(`
<div class="view">
  <div class="page-head">
    <h2>数据采集</h2>
    <el-tag :type="busy ? 'warning' : (st.status === 'done' ? 'success' : 'info')">{{ statusText }}</el-tag>
  </div>

  <el-row :gutter="12">
    <el-col :span="9">
      <el-card shadow="never">
        <template #header>采集参数</template>
        <el-form label-width="80px">
          <el-form-item label="关键词">
            <el-input v-model="form.keyword" placeholder="如：连衣裙" :disabled="busy" />
          </el-form-item>
          <el-form-item label="目标条数">
            <el-input-number v-model="form.pages" :min="1" :max="300" :step="20"
                             :disabled="busy" style="width:100%" />
            <div class="hint">每 1 单位 = 20 条，按页滚动加载</div>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="busy" @click="startCrawl">开始采集</el-button>
            <el-button v-if="busy" type="danger" plain @click="stopCrawl">停止</el-button>
            <el-button :loading="probing" @click="probe">接口探测</el-button>
          </el-form-item>
        </el-form>

        <el-progress v-if="st.status !== 'idle'"
                     :percentage="st.total ? Math.min(100, Math.round(st.fetched * 100 / st.total)) : (st.target ? Math.min(100, Math.round(st.fetched * 100 / st.target)) : 0)"
                     :status="st.status === 'failed' ? 'exception' : (st.status === 'done' ? 'success' : undefined)" />

        <div class="stat-row" style="margin-top:12px">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-num">{{ st.fetched }}</div><div class="stat-lb">已抓到</div>
          </el-card>
          <el-card shadow="hover" class="stat-card">
            <div class="stat-num">{{ st.inserted }}</div><div class="stat-lb">新增</div>
          </el-card>
          <el-card shadow="hover" class="stat-card">
            <div class="stat-num">{{ st.updated }}</div><div class="stat-lb">更新</div>
          </el-card>
          <el-card shadow="hover" class="stat-card">
            <div class="stat-num">{{ st.total || '-' }}</div><div class="stat-lb">平台总量</div>
          </el-card>
        </div>

        <el-alert v-if="st.error" type="error" :closable="false" style="margin-top:10px"
                  :title="st.error" />
      </el-card>

      <el-card shadow="never" style="margin-top:12px">
        <template #header>导出 CSV</template>
        <p class="hint">按当前关键词导出，或导出全部商品。</p>
        <el-button type="success" @click="exportCsv">导出当前关键词</el-button>
        <el-button @click="exportAll">导出全部</el-button>
      </el-card>
    </el-col>

    <el-col :span="15">
      <el-card shadow="never">
        <template #header>实时日志</template>
        <pre class="logbox">{{ logText }}</pre>
      </el-card>

      <el-card shadow="never" style="margin-top:12px">
        <template #header>抓取记录</template>
        <el-table :data="runs" border size="small" max-height="340">
          <el-table-column prop="keyword" label="关键词" width="110" />
          <el-table-column prop="source_name" label="来源" width="130" />
          <el-table-column prop="fetched" label="获取" width="70" />
          <el-table-column prop="inserted" label="新增" width="70" />
          <el-table-column prop="updated" label="更新" width="70" />
          <el-table-column label="结果" width="80">
            <template #default="s">
              <el-tag :type="s.row.ok ? 'success' : 'danger'" size="small">
                {{ s.row.ok ? '成功' : '失败' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="started_at" label="时间" min-width="150" />
        </el-table>
      </el-card>

      <el-card shadow="never" style="margin-top:12px" v-if="results.length">
        <template #header>接口探测结果</template>
        <el-table :data="results" border size="small">
          <el-table-column prop="name" label="接口" />
          <el-table-column prop="code" label="返回码" width="90" />
          <el-table-column prop="msg" label="说明" />
        </el-table>
      </el-card>
    </el-col>
  </el-row>

  <!-- 浏览器环境：换电脑后先看这一块 -->
  <el-card shadow="never" style="margin-top:12px">
    <template #header>
      <span>浏览器环境</span>
      <el-tag size="small" :type="br.found ? 'success' : 'danger'"
              style="margin-left:10px">{{ browserSummary }}</el-tag>
    </template>

    <el-descriptions :column="3" size="small" border>
      <el-descriptions-item label="程序位置">
        <span v-if="br.found" style="word-break:break-all">{{ br.path }}</span>
        <span v-else style="color:#f56c6c">未找到 msedge.exe / chrome.exe</span>
      </el-descriptions-item>
      <el-descriptions-item label="定位来源">{{ br.source || '—' }}</el-descriptions-item>
      <el-descriptions-item label="运行状态">
        {{ br.running ? ('已启动：' + br.version) : '未启动' }}
      </el-descriptions-item>
      <el-descriptions-item label="用户目录" :span="3">
        <span style="word-break:break-all;color:#909399">{{ br.profile }}</span>
      </el-descriptions-item>
    </el-descriptions>

    <div style="margin-top:14px">
      <el-form label-width="90px" style="max-width:960px">
        <el-form-item label="运行方式">
          <el-radio-group :model-value="br.mode" @change="setMode">
            <el-radio-button value="hidden">后台隐藏（推荐）</el-radio-button>
            <el-radio-button value="off">显示窗口</el-radio-button>
          </el-radio-group>
          <span class="hint" style="margin-left:12px">
            「后台隐藏」= 浏览器照常运行，但窗口挪到屏幕外，你完全看不见，实测抓取速度还更快
          </span>
        </el-form-item>

        <el-form-item label="浏览器路径">
          <el-input v-model="br.customPath" placeholder="自动检测失败时，手填完整路径，例如 C:\Program Files\Google\Chrome\Application\chrome.exe" clearable>
            <template #append>
              <el-button :loading="br.saving" @click="saveBrowserPath">保存</el-button>
            </template>
          </el-input>
          <div class="hint" style="margin-top:4px">
            已自动检测到 {{ br.candidates.length }} 个候选。
            不确定装哪了？点「诊断」看全部候选和来源。
          </div>
        </el-form-item>

        <el-form-item label="操作">
          <el-button :loading="br.diagnosing" @click="diagnose">诊断浏览器</el-button>
          <el-button :loading="br.loading" @click="loadBrowser">刷新状态</el-button>
        </el-form-item>
      </el-form>

      <pre v-if="br.diagnostic" class="logbox" style="max-height:280px">{{ br.diagnostic }}</pre>
    </div>
  </el-card>
</div>
`),
};


/* ==========================================================
 * 5. 维度分析
 * ========================================================== */
window.AnalysisView = {
    setup() {
        const tab = VRef('price');
        const rows = VRef([]);
        const loading = VRef(false);
        const chart = window.vbarChart({});
        const keyword = VRef('');

        const API_MAP = {
            price: API.analysisPrice,
            brand: API.analysisBrand,
            category: API.analysisCategory,
            discount: API.analysisDiscount,
            trend: API.analysisTrend,
            keyword: API.analysisKeyword,
        };
        const FIELD_MAP = {
            price: 'count', brand: 'count', category: 'count',
            discount: 'count', trend: 'count', keyword: 'count',
        };
        const LABEL_MAP = {
            price: 'band', brand: 'brand_name', category: 'name',
            discount: 'band', trend: 'day', keyword: 'keyword',
        };

        // ---------- 表格列定义 ----------
        // 每个维度自己声明列，而不是拿 Object.keys(rows[0]) 硬套。
        // 之前那套的直接后果：表头显示成 band / total_sales / avg_price，
        // 列宽全靠内容自适应，中文表头被挤成两行、数字列贴着边框，
        // 整张表看着又挤又难读。
        // 现在列宽写死、中文表头、必要时给数字右对齐。
        const COLUMNS = {
            price: [
                { prop: 'band', label: '价格区间', width: 130 },
                { prop: 'count', label: '商品数', width: 110, align: 'right' },
                { prop: 'avg_price', label: '平均售价', width: 120, align: 'right', money: true },
                { prop: 'total_sales', label: '总销量', width: 110, align: 'right' },
                { prop: 'low', label: '下限', width: 100, align: 'right', money: true },
                { prop: 'high', label: '上限', width: 100, align: 'right', money: true },
            ],
            brand: [
                { prop: 'brand_name', label: '品牌名称', minWidth: 160 },
                { prop: 'count', label: '商品数', width: 110, align: 'right' },
                { prop: 'avg_price', label: '平均售价', width: 120, align: 'right', money: true },
                { prop: 'min_price', label: '最低价', width: 110, align: 'right', money: true },
                { prop: 'max_price', label: '最高价', width: 110, align: 'right', money: true },
                { prop: 'total_sales', label: '总销量', width: 110, align: 'right' },
            ],
            category: [
                { prop: 'category_name', label: '类目名称', minWidth: 160 },
                { prop: 'count', label: '商品数', width: 110, align: 'right' },
                { prop: 'ratio', label: '占比(%)', width: 110, align: 'right', suffix: '%' },
                { prop: 'avg_price', label: '平均售价', width: 120, align: 'right', money: true },
                { prop: 'total_sales', label: '总销量', width: 110, align: 'right' },
            ],
            discount: [
                { prop: 'band', label: '折扣区间', width: 150 },
                { prop: 'count', label: '商品数', width: 120, align: 'right' },
                { prop: 'total_sales', label: '总销量', width: 120, align: 'right' },
            ],
            trend: [
                { prop: 'day', label: '日期', width: 150 },
                { prop: 'count', label: '新增商品', width: 130, align: 'right' },
                { prop: 'total_sales', label: '当天销量', width: 130, align: 'right' },
            ],
            keyword: [
                { prop: 'keyword', label: '采集关键词', minWidth: 180 },
                { prop: 'count', label: '商品数', width: 120, align: 'right' },
                { prop: 'avg_price', label: '平均售价', width: 130, align: 'right', money: true },
                { prop: 'total_sales', label: '总销量', width: 120, align: 'right' },
            ],
        };

        const TABS = [
            { value: 'price', label: '价格带' },
            { value: 'brand', label: '品牌' },
            { value: 'category', label: '类目' },
            { value: 'discount', label: '折扣' },
            { value: 'trend', label: '趋势' },
            { value: 'keyword', label: '关键词' },
        ];

        const columns = VComputed(function () {
            return COLUMNS[tab.value] || [];
        });

        // 单元格显示：money 加 ¥，空值显示 -，比例补 %
        function cellVal(row, col) {
            const v = row[col.prop];
            if (v === null || v === undefined || v === '') return '-';
            if (col.money) return '¥' + Number(v).toFixed(2);
            if (col.suffix) return v + col.suffix;
            return v;
        }

        async function load() {
            loading.value = true;
            try {
                const fn = API_MAP[tab.value];
                const params = keyword.value.trim()
                    ? { q: keyword.value.trim() } : {};
                const d = await fn(params);
                rows.value = Array.isArray(d) ? d : (d.items || []);
                chart.render(rows.value, FIELD_MAP[tab.value], LABEL_MAP[tab.value]);
            } catch (e) { /* 已弹错 */ } finally { loading.value = false;
            }
        }

        function reset() {
            keyword.value = '';
            load();
        }

        function exportCsv() {
            const cols = columns.value;
            const header = cols.map(c => c.label).join(',');
            const body = rows.value.map(r =>
                cols.map(c => {
                    const v = r[c.prop];
                    return (v === null || v === undefined) ? '' : String(v);
                }).join(',')
            ).join('\n');
            // 加 BOM，否则 Excel 打开中文乱码
            const blob = new Blob(['﻿' + header + '\n' + body],
                                  { type: 'text/csv;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = '维度分析_' + tab.value + '.csv';
            a.click();
            URL.revokeObjectURL(a.href);
            toast('已导出 ' + rows.value.length + ' 行');
        }

        const summary = VComputed(function () {
            const total = rows.value.reduce(function (s, r) {
                return s + Number(r.count || 0);
            }, 0);
            return total;
        });

        VWatch(tab, load);
        VMounted(load);
        return {
            tab, tabs: TABS, rows, loading, chart, keyword, columns,
            summary, cellVal, load, reset, exportCsv, fmtMoney: window.fmtMoney,
        };
    },

    template: tpl(`
<div v-loading="loading" class="view">
  <div class="page-head">
    <h2>维度分析</h2>
    <div>
      <el-input v-model="keyword" placeholder="按关键词/商品名过滤" style="width:200px"
                clearable @keyup.enter="load" />
      <el-button @click="load">查询</el-button>
      <el-button @click="reset">重置</el-button>
      <el-button type="primary" plain @click="exportCsv">导出本表</el-button>
    </div>
  </div>

  <el-card shadow="never" class="dim-card">
    <div class="dim-head">
      <el-radio-group v-model="tab">
        <el-radio-button v-for="t in tabs" :key="t.value" :value="t.value">
          {{ t.label }}
        </el-radio-button>
      </el-radio-group>
      <span class="hint">共 {{ rows.length }} 行，合计 {{ summary }} 件商品</span>
    </div>

    <div :ref="el => chart.bind(el)" class="chart chart-tall"></div>

    <el-table :data="rows" border stripe class="dim-table" size="default">
      <el-table-column type="index" label="#" width="60" align="center" />
      <el-table-column v-for="c in columns" :key="c.prop"
                       :prop="c.prop" :label="c.label"
                       :width="c.width" :min-width="c.minWidth"
                       :align="c.align || 'left'"
                       show-overflow-tooltip>
        <template #default="s">{{ cellVal(s.row, c) }}</template>
      </el-table-column>
    </el-table>
  </el-card>
</div>
`),
};

/* ==========================================================
 * 6. 登录账号
 * ========================================================== */
window.AccountView = {
    setup() {
        const rows = VRef([]);
        const loading = VRef(false);
        const dlg = VReactive({ visible: false, phone: '', cookie: '' });

        async function load() {
            loading.value = true;
            try {
                const d = await API.accounts();
                rows.value = d.items || [];
            } catch (e) { /* 已弹错 */ } finally { loading.value = false; }
        }

        async function save() {
            if (!dlg.phone) return toast('请输入手机号', 'warn');
            try {
                await API.accountSave({ phone: dlg.phone, cookie: dlg.cookie });
                toast('已保存');
                dlg.visible = false; dlg.phone = ''; dlg.cookie = '';
                load();
            } catch (e) { /* 已弹错 */ }
        }

        async function remove(row) {
            await ElementPlus.ElMessageBox.confirm('删除账号 ' + row.phone + '？', '确认', { type: 'warning' });
            try {
                await API.accountDelete(row.id);
                toast('已删除');
                load();
            } catch (e) { /* 已弹错 */ }
        }

        VMounted(load);
        return { rows, loading, dlg, load, save, remove, fmtMoney: window.fmtMoney };
    },
    template: tpl(`
<div v-loading="loading" class="view">
  <div class="page-head">
    <h2>登录账号</h2>
    <div>
      <el-button @click="load">刷新</el-button>
      <el-button type="primary" @click="dlg.visible = true">添加账号</el-button>
    </div>
  </div>
  <el-card shadow="never">
    <el-alert type="info" :closable="false" style="margin-bottom:12px"
      title="采集需要登录态。Cookie 获取：浏览器登录唯品会 → F12 → Network → 任取一个请求 → 复制 Request Headers 里的整条 Cookie" />
    <el-table :data="rows" border stripe>
      <el-table-column type="index" label="#" width="55" />
      <el-table-column prop="phone" label="手机号" width="140" />
      <el-table-column prop="nickname" label="昵称" />
      <el-table-column label="状态" width="110">
        <template #default="s">
          <el-tag :type="s.row.is_logged_in ? 'success' : 'info'" size="small">
            {{ s.row.is_logged_in ? '已配置' : '未配置' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="last_login" label="最近登录" width="180" />
      <el-table-column label="操作" width="90">
        <template #default="s">
          <el-button link type="danger" @click="remove(s.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rows.length && !loading" description="暂无账号" />
  </el-card>

  <el-dialog v-model="dlg.visible" title="添加爬虫账号" width="640">
    <el-form label-width="90px">
      <el-form-item label="手机号">
        <el-input v-model="dlg.phone" placeholder="登录唯品会的手机号" />
      </el-form-item>
      <el-form-item label="Cookie">
        <el-input v-model="dlg.cookie" type="textarea" :rows="8" placeholder="完整 Cookie 字符串" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dlg.visible = false">取消</el-button>
      <el-button type="primary" @click="save">保存</el-button>
    </template>
  </el-dialog>
</div>
`),
};

/* ==========================================================
 * 7. 来源管理
 * ========================================================== */
window.SourceView = {
    setup() {
        const rows = VRef([]);
        const loading = VRef(false);

        async function load() {
            loading.value = true;
            try {
                const d = await API.sources();
                rows.value = d.items || [];
            } catch (e) { /* 已弹错 */ } finally { loading.value = false; }
        }
        VMounted(load);
        return { rows, loading, load, fmtMoney: window.fmtMoney };
    },
    template: tpl(`
<div v-loading="loading" class="view">
  <div class="page-head">
    <h2>来源管理</h2>
    <el-button @click="load">刷新</el-button>
  </div>
  <el-card shadow="never">
    <el-table :data="rows" border stripe>
      <el-table-column type="index" label="#" width="55" />
      <el-table-column prop="name" label="来源名称" min-width="200" />
      <el-table-column prop="key" label="标识" width="150" />
      <el-table-column prop="source_type" label="类型" width="110" />
      <el-table-column prop="product_count" label="商品数" width="100" />
      <el-table-column label="状态" width="90">
        <template #default="s">
          <el-tag :type="s.row.is_active ? 'success' : 'info'" size="small">
            {{ s.row.is_active ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="200" />
    </el-table>
    <el-empty v-if="!rows.length && !loading" description="暂无来源" />
  </el-card>
</div>
`),
};

/* ==========================================================
 * 8. 抓取记录
 * ========================================================== */
window.RunView = {
    setup() {
        const rows = VRef([]);
        const total = VRef(0);
        const loading = VRef(false);
        const page = VRef(1);
        const size = VRef(20);

        async function load() {
            loading.value = true;
            try {
                const d = await API.runs({ page: page.value, page_size: size.value });
                rows.value = d.items || [];
                total.value = d.total || rows.value.length;
            } catch (e) { /* 已弹错 */ } finally { loading.value = false; }
        }

        VMounted(load);
        return { rows, total, loading, page, size, load, fmtMoney: window.fmtMoney };
    },
    template: tpl(`
<div v-loading="loading" class="view">
  <div class="page-head">
    <h2>抓取记录</h2>
    <el-button @click="load">刷新</el-button>
  </div>
  <el-card shadow="never">
    <el-table :data="rows" border stripe>
      <el-table-column type="index" label="#" width="55" />
      <el-table-column prop="source_name" label="来源" width="150" />
      <el-table-column prop="keyword" label="关键词" width="130" />
      <el-table-column prop="fetched" label="获取" width="80" />
      <el-table-column prop="inserted" label="新增" width="80" />
      <el-table-column prop="updated" label="更新" width="80" />
      <el-table-column label="结果" width="90">
        <template #default="s">
          <el-tag :type="s.row.ok ? 'success' : 'danger'" size="small">
            {{ s.row.ok ? '成功' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="started_at" label="开始时间" width="180" />
      <el-table-column prop="finished_at" label="结束时间" width="180" />
    </el-table>
    <el-pagination class="pager"
      layout="total, sizes, prev, pager, next"
      :total="total" :page-size="size" :current-page="page"
      :page-sizes="[20, 50, 100]"
      @current-change="v => { page = v; load(); }"
      @size-change="v => { size = v; page = 1; load(); }" />
  </el-card>
</div>
`),
};

/* ==========================================================
 * 6. AI 助手（千问 / DeepSeek / 豆包）
 * ========================================================== */
window.AiView = {
    setup() {
        const ARef = VRef, AReactive = VReactive, AComputed = VComputed;

        const tab = ARef('recommend');
        const brands = ARef([]);
        const categories = ARef([]);

        // 品牌/类目下拉的数据源。app.js 里的 loadMenuData 也拉过一份，
        // 但那是组件局部的，这里独立拉一次，省得两边互相耦合。
        async function loadDims() {
            try {
                const [b, c] = await Promise.all([
                    API.brands().catch(function () { return null; }),
                    API.categories().catch(function () { return null; }),
                ]);
                if (b && b.items) brands.value = b.items;
                if (c && c.items) categories.value = c.items;
            } catch (e) { /* 已弹错 */ }
        }

        // ---------- 厂商配置 ----------
        const providers = ARef([]);
        const providerMap = AComputed(function () {
            const m = {};
            providers.value.forEach(function (p) { m[p.key] = p; });
            return m;
        });
        const provider = ARef('deepseek');
        const model = ARef('');
        const cfgLoading = ARef(false);
        const testing = ARef('');
        const testMsg = AReactive({ text: '', type: '' });
        const edit = AReactive({ qwen: {}, deepseek: {}, doubao: {} });

        // ---------- 商品推荐 ----------
        // 价格上下限必须是 null，不能是 0。
        //
        // 血泪坑：Element 的 el-input-number 不接受 undefined，值只能是 null 或数字，
        // 写 undefined 会让它自己兜成 0。而后端拿到 0 会当成「只卖 0 元的商品」，
        // 结果就是候选池清空，页面上一条推荐都不出，还看不出是哪步错了。
        const form = AReactive({
            demand: '', keyword: '', brand: '', category: '',
            price_min: null, price_max: null, top_n: 8, pool_size: 40,
        });
        const recLoading = ARef(false);
        const recResult = ARef({ items: [], candidate_count: 0, elapsed: 0, model: '' });

        // ---------- 看板洞察 ----------
        const insightLoading = ARef(false);
        const insightKeyword = ARef('');
        const insight = ARef(null);

        // ---------- 营销文案 ----------
        const copyLoading = ARef(false);
        const copyForm = AReactive({ product_id: null, style: '种草' });
        const copyResult = ARef(null);
        const productOptions = ARef([]);

        // ---------- 历史记录 ----------
        const recs = ARef([]);
        const recsLoading = ARef(false);

        const providerLabel = AComputed(function () {
            const p = providerMap.value[provider.value];
            return p ? p.label : provider.value;
        });

        // 切厂商时把模型同步成该厂商的当前模型。
        // 用 watch 而不是 computed 挂副作用 —— computed 只在首次渲染跑一次，
        // 后面切厂商不会重新触发。
        VWatch(provider, function () {
            const p = providerMap.value[provider.value];
            if (p) model.value = p.model;
        });

        async function loadProviders() {
            cfgLoading.value = true;
            try {
                const d = await API.aiProviders();
                providers.value = d.items || [];
                if (d.default_provider) provider.value = d.default_provider;
                // 把已有配置回填到编辑表单
                providers.value.forEach(function (p) {
                    edit[p.key] = {
                        api_key: p.api_key_masked || '',
                        base_url: p.base_url,
                        model: p.model,
                        is_active: p.is_active,
                        is_default: p.is_default,
                    };
                });
            } catch (e) { /* 已弹错 */ } finally {
                cfgLoading.value = false;
            }
        }

        async function saveProvider(key) {
            const e = edit[key];
            try {
                await API.aiProviderSave({
                    provider: key, api_key: e.api_key,
                    base_url: e.base_url, model: e.model,
                    is_active: e.is_active, is_default: e.is_default,
                });
                toast('配置已保存');
                await loadProviders();
            } catch (err) { /* 已弹错 */ }
        }

        async function testProvider(key) {
            testing.value = key;
            testMsg.text = '';
            try {
                const d = await API.aiProviderTest({ provider: key });
                testMsg.type = 'ok';
                testMsg.text = key + ' 连通正常：' + d.reply + '（' + d.latency + 's）';
            } catch (err) {
                testMsg.type = 'err';
                testMsg.text = key + ' 连通失败：' + (err.message || '');
            } finally {
                testing.value = '';
            }
        }

        async function runRecommend() {
            if (!form.demand.trim()) return toast('请先填写选品需求', 'warn');
            recLoading.value = true;
            try {
                const d = await API.aiRecommend(Object.assign({ provider: provider.value }, form));
                recResult.value = d;
                toast('AI 推荐完成，共 ' + d.items.length + ' 款');
            } catch (e) { /* 已弹错 */ } finally {
                recLoading.value = false;
            }
        }

        async function markProduct(id, action) {
            try {
                await API.aiRecommendMark({ product_id: id, action: action });
                toast(action === 'mark' ? '已标记为推荐' : '已取消推荐');
            } catch (e) { /* 已弹错 */ }
        }

        async function runInsight() {
            insightLoading.value = true;
            try {
                const d = await API.aiInsight({
                    provider: provider.value, keyword: insightKeyword.value,
                });
                insight.value = d.result;
                loadRecords();
            } catch (e) { /* 已弹错 */ } finally {
                insightLoading.value = false;
            }
        }

        // 文案页要选商品，先拉一批最新的做下拉
        async function loadProductOptions() {
            if (productOptions.value.length) return;
            try {
                const d = await API.products({ page_size: 50, ordering: '-id' });
                productOptions.value = (d.items || []).map(function (p) {
                    return { id: p.id, label: (p.title || '').slice(0, 36) };
                });
            } catch (e) { /* 已弹错 */ }
        }

        async function runCopy() {
            if (!copyForm.product_id) return toast('请先选择商品', 'warn');
            copyLoading.value = true;
            try {
                const d = await API.aiCopy(Object.assign({
                    provider: provider.value,
                }, copyForm));
                copyResult.value = d;
                loadRecords();
            } catch (e) { /* 已弹错 */ } finally {
                copyLoading.value = false;
            }
        }

        async function loadRecords() {
            recsLoading.value = true;
            try {
                const d = await API.aiRecords({ limit: 30 });
                recs.value = d.items || [];
            } catch (e) { /* 已弹错 */ } finally {
                recsLoading.value = false;
            }
        }

        // 切到文案页时才去拉商品列表，避免首屏白等
        VWatch(tab, function (v) { if (v === 'copy') loadProductOptions(); });

        VMounted(function () {
            loadProviders();
            loadRecords();
            loadDims();
        });

        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(function () {
                toast('已复制到剪贴板');
            }).catch(function () {
                toast('复制失败，请手动选中', 'warn');
            });
        }

        // 标题与正文拼一起复制。
        //
        // 血泪坑：模板是反引号字符串，'\n' 会被 JS 先解析成真换行，
        // Vue 模板里就出现一个裸换行符 -> compiler-38「Invalid or unexpected token」
        // -> 整页白屏。所以换行符一律在 setup 里拼，模板里只留方法名。
        function copyFullCopy() {
            if (!copyResult.value) return;
            const r = copyResult.value.result;
            const points = (r.selling_points || []).join('；');
            copyToClipboard([r.title, points, r.copy].join('\n'));
        }

        const levelType = function (lv) {
            return lv === 'good' ? 'success' : (lv === 'warn' ? 'warning' : 'info');
        };

        return {
            tab, brands, categories, providers, providerMap, provider, model,
            cfgLoading, testing, testMsg, edit,
            form, recLoading, recResult,
            insightLoading, insightKeyword, insight,
            copyLoading, copyForm, copyResult, productOptions,
            recs, recsLoading, providerLabel,
            loadProviders, saveProvider, testProvider,
            runRecommend, markProduct, runInsight, runCopy, loadRecords,
            copyToClipboard, copyFullCopy, levelType,
            fmtMoney: window.fmtMoney,
        };
    },

    template: tpl(`
<div class="view ai-view">
  <div class="page-head">
    <h2>AI 助手</h2>
    <el-select v-model="provider" style="width:190px">
      <el-option v-for="p in providers" :key="p.key" :value="p.key" :label="p.label" />
    </el-select>
    <el-input v-model="model" placeholder="模型名称" style="width:180px" />
    <el-button @click="tab='config'" :type="tab==='config' ? 'primary' : ''">模型配置</el-button>
  </div>

  <el-tabs v-model="tab">
    <!-- ============ 商品推荐 ============ -->
    <el-tab-pane label="商品推荐" name="recommend">
      <el-card shadow="never" class="ai-form">
        <el-form label-width="90px">
          <el-form-item label="选品需求">
            <el-input v-model="form.demand" type="textarea" :rows="2"
              placeholder="用自然语言描述你的选品方向，例如：想做 200 元以内的女士通勤连衣裙，要显瘦、适合秋季" />
          </el-form-item>
          <el-row :gutter="12">
            <el-col :span="6">
              <el-form-item label="关键词"><el-input v-model="form.keyword" placeholder="选填" /></el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="品牌">
                <el-select v-model="form.brand" clearable filterable placeholder="全部">
                  <el-option v-for="b in brands" :key="b.name" :value="b.name" :label="b.name" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="类目">
                <el-select v-model="form.category" clearable filterable placeholder="全部">
                  <el-option v-for="c in categories" :key="c.name" :value="c.name" :label="c.name" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="价格区间">
                <el-input-number v-model="form.price_min" :min="0" :controls="false" placeholder="最低" style="width:88px" />
                <span style="margin:0 4px">-</span>
                <el-input-number v-model="form.price_max" :min="0" :controls="false" placeholder="最高" style="width:88px" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="12">
            <el-col :span="6">
              <el-form-item label="推荐条数"><el-input-number v-model="form.top_n" :min="1" :max="20" /></el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="候选池"><el-input-number v-model="form.pool_size" :min="10" :max="60" /></el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label=" ">
                <el-button type="primary" :loading="recLoading" @click="runRecommend">
                  {{ recLoading ? 'AI 思考中…' : '开始智能推荐' }}
                </el-button>
                <span class="hint" style="margin-left:10px">当前厂商：{{ providerLabel }}</span>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </el-card>

      <div v-if="recResult.items && recResult.items.length" style="margin-top:14px">
        <p class="hint">
          从 {{ recResult.candidate_count }} 款候选中精选 {{ recResult.items.length }} 款 ·
          模型 {{ recResult.model }} · 耗时 {{ recResult.elapsed }}s
        </p>
        <el-row :gutter="12">
          <el-col :span="8" v-for="it in recResult.items" :key="it.product.id">
            <el-card shadow="hover" class="ai-card">
              <div class="ai-score">{{ it.score }}<span>分</span></div>
              <div class="ai-title" :title="it.product.title">{{ it.product.title }}</div>
              <div class="ai-meta">
                <span>{{ it.product.brand_name || '未知品牌' }}</span>
                <span>{{ fmtMoney(it.product.price) }}</span>
                <span v-if="it.product.sales">销量 {{ it.product.sales }}</span>
              </div>
              <div class="ai-reason">{{ it.reason }}</div>
              <div class="ai-tags">
                <el-tag v-for="t in it.tags" :key="t" size="small" effect="plain">{{ t }}</el-tag>
              </div>
              <div class="ai-actions">
                <el-button size="small" @click="markProduct(it.product.id,'mark')">标记推荐</el-button>
                <el-button size="small" type="text" @click="copyToClipboard(it.reason)">复制理由</el-button>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>
    </el-tab-pane>

    <!-- ============ 看板洞察 ============ -->
    <el-tab-pane label="看板洞察" name="insight">
      <el-card shadow="never" class="ai-form">
        <el-form label-width="90px" inline>
          <el-form-item label="关键词">
            <el-input v-model="insightKeyword" placeholder="留空分析全部" style="width:200px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="insightLoading" @click="runInsight">
              {{ insightLoading ? 'AI 分析中…' : '生成数据复盘' }}
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <div v-if="insight" style="margin-top:14px">
        <el-card shadow="never">
          <h3 style="margin-top:0">整体结论</h3>
          <p style="line-height:1.9">{{ insight.summary }}</p>
        </el-card>
        <el-row :gutter="12" style="margin-top:12px">
          <el-col :span="12" v-for="(ins, i) in insight.insights" :key="i">
            <el-card shadow="hover">
              <el-tag :type="levelType(ins.level)" size="small">{{ ins.title }}</el-tag>
              <p style="margin:8px 0 0;line-height:1.8">{{ ins.detail }}</p>
            </el-card>
          </el-col>
        </el-row>
        <el-card shadow="never" style="margin-top:12px">
          <h3 style="margin-top:0">运营建议</h3>
          <ol style="line-height:2;padding-left:20px">
            <li v-for="(a, i) in insight.advice" :key="i">{{ a }}</li>
          </ol>
        </el-card>
      </div>
    </el-tab-pane>

    <!-- ============ 营销文案 ============ -->
    <el-tab-pane label="营销文案" name="copy">
      <el-card shadow="never" class="ai-form">
        <el-form label-width="90px">
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="选择商品">
                <el-select v-model="copyForm.product_id" filterable placeholder="选一个商品" style="width:100%">
                  <el-option v-for="o in productOptions" :key="o.id" :value="o.id" :label="o.label" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="文案风格">
                <el-select v-model="copyForm.style" style="width:100%">
                  <el-option value="normal" label="客观平实" />
                  <el-option value="种草" label="种草口语" />
                  <el-option value="高端" label="高端质感" />
                  <el-option value="专业" label="专业参数" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label=" ">
                <el-button type="primary" :loading="copyLoading" @click="runCopy">
                  {{ copyLoading ? '生成中…' : '生成文案' }}
                </el-button>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </el-card>

      <el-card v-if="copyResult" shadow="never" style="margin-top:14px">
        <el-form-item label="商品标题">
          <el-input :model-value="copyResult.result.title" readonly />
        </el-form-item>
        <el-form-item label="核心卖点">
          <el-tag v-for="(s, i) in copyResult.result.selling_points" :key="i"
                  style="margin-right:8px">{{ s }}</el-tag>
        </el-form-item>
        <el-form-item label="正文">
          <el-input :model-value="copyResult.result.copy" type="textarea" :rows="5" readonly />
        </el-form-item>
        <el-button size="small" @click="copyFullCopy">复制全文</el-button>
      </el-card>
    </el-tab-pane>

    <!-- ============ 模型配置 ============ -->
    <el-tab-pane label="模型配置" name="config">
      <el-alert type="info" :closable="false" style="margin-bottom:12px"
        title="三家都提供 OpenAI 兼容接口，填 Key 后点「连通测试」验证。Key 只存本地数据库，不会上传到任何第三方。" />

      <el-card v-for="p in providers" :key="p.key" shadow="never" class="ai-cfg">
        <div class="ai-cfg-head">
          <strong>{{ p.label }}</strong>
          <el-tag v-if="p.is_default" type="success" size="small">默认</el-tag>
          <el-tag :type="p.configured ? 'success' : 'info'" size="small">
            {{ p.configured ? '已配置' : '未配置' }}
          </el-tag>
          <div class="spacer"></div>
          <a :href="p.key_url" target="_blank" rel="noopener" class="ai-link">申请 API Key</a>
          <a :href="p.docs_url" target="_blank" rel="noopener" class="ai-link">接口文档</a>
        </div>
        <p class="hint">{{ p.note }}</p>
        <el-form label-width="80px" size="small">
          <el-row :gutter="12">
            <el-col :span="8">
              <el-form-item label="API Key">
                <el-input v-model="edit[p.key].api_key" placeholder="sk-..." show-password />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="接口地址">
                <el-input v-model="edit[p.key].base_url" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="模型">
                <el-select v-model="edit[p.key].model" style="width:100%" filterable allow-create>
                  <el-option v-for="m in p.models" :key="m" :value="m" :label="m" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item>
            <el-checkbox v-model="edit[p.key].is_active">启用</el-checkbox>
            <el-checkbox v-model="edit[p.key].is_default">设为默认厂商</el-checkbox>
            <div class="spacer"></div>
            <el-button size="small" @click="testProvider(p.key)" :loading="testing===p.key">连通测试</el-button>
            <el-button size="small" type="primary" @click="saveProvider(p.key)">保存</el-button>
          </el-form-item>
          <p v-if="p.last_check" class="hint">
            上次检测 {{ p.last_check }} ·
            <span :style="p.last_error ? 'color:#f56c6c' : 'color:#67c23a'">
              {{ p.last_error || ('正常 ' + p.last_latency + 's') }}
            </span>
          </p>
        </el-form>
      </el-card>

      <p v-if="testMsg.text" class="hint" :style="testMsg.type==='ok' ? 'color:#67c23a' : 'color:#f56c6c'">
        {{ testMsg.text }}
      </p>
    </el-tab-pane>

    <!-- ============ 调用历史 ============ -->
    <el-tab-pane label="调用历史" name="records">
      <el-card shadow="never">
        <el-table :data="recs" border stripe v-loading="recsLoading">
          <el-table-column type="index" label="#" width="55" />
          <el-table-column prop="run_type_label" label="类型" width="100" />
          <el-table-column prop="demand" label="需求/说明" show-overflow-tooltip />
          <el-table-column prop="product_title" label="商品" show-overflow-tooltip />
          <el-table-column prop="score" label="分数" width="80" />
          <el-table-column prop="model" label="模型" width="180" />
          <el-table-column prop="elapsed" label="耗时(s)" width="90" />
          <el-table-column prop="create_time" label="时间" width="170" />
        </el-table>
      </el-card>
    </el-tab-pane>
  </el-tabs>
</div>
`),
};


/* ==========================================================
 * 7. 数据接口（对接数据网 / 第三方 API）
 * ========================================================== */
window.ApiSourceView = {
    setup() {
        const rows = VRef([]);
        const loading = VRef(false);
        const q = VRef('');
        const fieldDefs = VRef({});
        const authTypes = VRef([]);

        const dlg = VRef(false);
        const saving = VRef(false);
        const probing = VRef(false);
        const fetching = VRef(0);
        const probeMsg = VReactive({ type: '', text: '', detail: null });

        // 表单初值
        const EMPTY = {
            id: null, name: '', url: '', method: 'GET',
            auth_type: 'none', api_key: '', header_name: '',
            list_path: '', limit: 200, is_active: true,
            field_map: {}, request_body: '',
        };
        const form = VReactive(Object.assign({}, EMPTY));

        // 探测返回的原始字段名，用来给「字段对应」下拉提供选项
        const rawFields = VRef([]);
        // 已经填过映射的字段，界面上单独列出来，避免用户对着空表发愁
        const mapped = VComputed(function () {
            const m = form.field_map || {};
            return Object.keys(m).filter(function (k) { return m[k]; });
        });

        async function load() {
            loading.value = true;
            try {
                const d = await API.apiSources({ q: q.value });
                rows.value = d.items || [];
                fieldDefs.value = d.field_defs || {};
                authTypes.value = d.auth_types || [];
            } catch (e) { /* 已弹错 */ } finally {
                loading.value = false;
            }
        }

        function openCreate() {
            Object.keys(EMPTY).forEach(function (k) { form[k] = EMPTY[k]; });
            rawFields.value = [];
            probeMsg.type = ''; probeMsg.text = ''; probeMsg.detail = null;
            dlg.value = true;
        }

        function openEdit(row) {
            Object.keys(EMPTY).forEach(function (k) { form[k] = EMPTY[k]; });
            form.id = row.id;
            form.name = row.name;
            form.url = row.url;
            form.method = row.method;
            form.auth_type = row.auth_type;
            form.api_key = row.api_key_masked;
            form.header_name = row.header_name;
            form.list_path = row.list_path;
            form.limit = row.limit;
            form.is_active = row.is_active;
            form.field_map = Object.assign({}, row.field_map || {});
            form.request_body = row.request_body;
            rawFields.value = [];
            probeMsg.type = ''; probeMsg.text = ''; probeMsg.detail = null;
            dlg.value = true;
        }

        async function save() {
            if (!form.name.trim()) return toast('请填写接口名称', 'warn');
            saving.value = true;
            try {
                await API.apiSourceSave(form);
                toast('已保存');
                dlg.value = false;
                load();
            } catch (e) { /* 已弹错 */ } finally {
                saving.value = false;
            }
        }

        async function remove(row) {
            await ElementPlus.ElMessageBox.confirm(
                '确定删除接口「' + row.name + '」？已拉取的商品不会被删除。',
                '确认删除', { type: 'warning' });
            try {
                await API.apiSourceDelete(row.id);
                toast('已删除');
                load();
            } catch (e) { /* 已弹错 */ }
        }

        // 连通测试：不写库，只看通不通、返回了什么
        async function probe() {
            if (!form.url.trim()) return toast('请先填写接口地址', 'warn');
            probing.value = true;
            probeMsg.type = ''; probeMsg.text = ''; probeMsg.detail = null;
            try {
                const d = await API.apiSourceProbe(form);
                rawFields.value = d.fields || [];
                probeMsg.type = 'ok';
                probeMsg.text = '连通正常，取到 ' + d.count + ' 条，耗时 '
                                 + d.elapsed + ' 秒';
                probeMsg.detail = d;
                // 后端自动猜的映射直接填进表单，用户可以在此基础上改
                if (d.guessed_map && Object.keys(d.guessed_map).length) {
                    form.field_map = Object.assign({}, d.guessed_map);
                    toast('已自动匹配 ' + Object.keys(d.guessed_map).length + ' 个字段');
                }
            } catch (e) {
                probeMsg.type = 'err';
                probeMsg.text = e.message || '连通失败';
            } finally {
                probing.value = false;
            }
        }

        async function fetchOne(row) {
            fetching.value = row.id;
            try {
                const d = await API.apiSourceFetch({ id: row.id });
                toast('拉取完成：新增 ' + d.created + '，更新 ' + d.updated);
                load();
            } catch (e) { /* 已弹错 */ } finally {
                fetching.value = 0;
            }
        }

        // 字段对应：给内部字段挑一个接口里的字段名
        function setMapping(internal, external) {
            const m = Object.assign({}, form.field_map);
            if (external) {
                m[internal] = external;
            } else {
                delete m[internal];
            }
            form.field_map = m;
        }

        function mappingOf(internal) {
            return (form.field_map || {})[internal] || '';
        }

        // 内部字段的可选项（给下拉用）
        function internalKeys() {
            return Object.keys(fieldDefs.value || {});
        }

        function internalLabel(internal) {
            return (fieldDefs.value || {})[internal] || internal;
        }

        function reqBodyPretty() {
            try {
                return form.request_body ? JSON.stringify(
                    JSON.parse(form.request_body), null, 2) : '';
            } catch (e) { return '(JSON 格式有误)'; }
        }

        VMounted(load);
        return {
            rows, loading, q, dlg, saving, probing, fetching, form, probeMsg,
            fieldDefs, authTypes, rawFields, mapped,
            load, openCreate, openEdit, save, remove, probe, fetchOne,
            setMapping, mappingOf, internalKeys, internalLabel, reqBodyPretty,
        };
    },

    template: tpl(`
<div v-loading="loading" class="view">
  <div class="page-head">
    <h2>数据接口</h2>
    <div>
      <el-input v-model="q" placeholder="搜索接口名称或地址" style="width:200px"
                clearable @keyup.enter="load" />
      <el-button @click="load">刷新</el-button>
      <el-button type="primary" @click="openCreate">新增接口</el-button>
    </div>
  </div>

  <el-alert type="info" :closable="false" style="margin-bottom:12px">
    <template #title>
      把任意返回 JSON 的商品接口接进来即可入库分析。填好地址与 Key 后
      先点「连通测试」—— 它不会写库，可以放心反复试；通了再点「拉取入库」。
      必填的映射是「商品名称」，其余可留空。
    </template>
  </el-alert>

  <el-card shadow="never">
    <el-table :data="rows" border stripe>
      <el-table-column type="index" label="#" width="55" align="center" />
      <el-table-column label="接口名称" min-width="140">
        <template #default="s">
          <div class="cell-title">{{ s.row.name }}</div>
          <div class="cell-sub">{{ s.row.url }}</div>
        </template>
      </el-table-column>
      <el-table-column label="方式" width="80">
        <template #default="s">
          <el-tag size="small" effect="plain">{{ s.row.method }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="鉴权" width="130">
        <template #default="s">
          <el-tag size="small" :type="s.row.configured ? 'success' : 'info'">
            {{ s.row.configured ? '已配置' : '需填Key' }}
          </el-tag>
          <div class="cell-sub">{{ s.row.api_key_masked || '—' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="上次检测" width="200">
        <template #default="s">
          <template v-if="s.row.last_check">
            <div class="cell-sub">{{ s.row.last_check }}</div>
            <div :style="s.row.last_error ? 'color:#f56c6c' : 'color:#67c23a'">
              {{ s.row.last_error || ('正常 ' + s.row.last_count + ' 条 / '
                                      + s.row.last_latency + 's') }}
            </div>
          </template>
          <span v-else class="hint">未检测</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="s">
          <el-tag size="small" :type="s.row.is_active ? 'success' : 'info'"
                  effect="plain">{{ s.row.is_active ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="s">
          <el-button link type="primary" @click="fetchOne(s.row)"
                     :loading="fetching === s.row.id">拉取入库</el-button>
          <el-button link type="primary" @click="openEdit(s.row)">编辑</el-button>
          <el-button link type="danger" @click="remove(s.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && !rows.length" description="还没有配置数据接口" />
  </el-card>

  <!-- ============ 新增 / 编辑接口 ============ -->
  <el-dialog v-model="dlg" :title="form.id ? '编辑接口' : '新增接口'"
             width="780px" top="5vh" destroy-on-close>
    <el-form label-width="100px" size="small">
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="接口名称" required>
            <el-input v-model="form.name" placeholder="如：某数据网商品接口" />
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="请求方式">
            <el-select v-model="form.method" style="width:100%">
              <el-option value="GET" label="GET" />
              <el-option value="POST" label="POST" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="拉取上限">
            <el-input-number v-model="form.limit" :min="1" :max="5000"
                             :controls="false" style="width:100%" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="接口地址" required>
        <el-input v-model="form.url" placeholder="https://api.example.com/goods?kw=连衣裙" />
      </el-form-item>

      <el-row :gutter="12">
        <el-col :span="8">
          <el-form-item label="鉴权方式">
            <el-select v-model="form.auth_type" style="width:100%">
              <el-option v-for="a in authTypes" :key="a.value"
                         :value="a.value" :label="a.label" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="10">
          <el-form-item label="API Key">
            <el-input v-model="form.api_key" placeholder="选填" show-password
                      :disabled="form.auth_type === 'none'" />
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="自定义头名">
            <el-input v-model="form.header_name" placeholder="X-Api-Key"
                      :disabled="form.auth_type !== 'header'" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item v-if="form.method === 'POST'" label="请求体">
        <el-input v-model="form.request_body" type="textarea" :rows="3"
                  placeholder='{"keyword":"连衣裙","page":1}' />
      </el-form-item>

      <el-form-item label="数据路径">
        <el-input v-model="form.list_path" placeholder="如 data.list，留空则自动探测" />
      </el-form-item>

      <el-form-item label=" ">
        <el-button type="primary" :loading="probing" @click="probe">
          {{ probing ? '测试中…' : '连通测试' }}
        </el-button>
        <el-button type="success" :loading="saving" @click="save">保存</el-button>
        <el-button v-if="form.id" @click="probe">重新测试</el-button>
      </el-form-item>
    </el-form>

    <!-- 连通测试结果 -->
    <div v-if="probeMsg.text" class="probe-box">
      <el-alert :type="probeMsg.type === 'ok' ? 'success' : 'error'"
                :title="probeMsg.text" :closable="false" show-icon />
      <div v-if="probeMsg.detail" class="probe-detail">
        <p v-if="probeMsg.detail.top_keys">
          <span class="hint">返回顶层字段：</span>
          <code>{{ probeMsg.detail.top_keys.join(', ') }}</code>
        </p>
        <p v-if="probeMsg.detail.fields.length">
          <span class="hint">可用字段名：</span>
          <code>{{ probeMsg.detail.fields.join(', ') }}</code>
        </p>
        <p v-if="probeMsg.detail.sample">
          <span class="hint">首条数据样例：</span>
          <pre>{{ JSON.stringify(probeMsg.detail.sample, null, 2) }}</pre>
        </p>
      </div>
    </div>

    <!-- 字段对应 -->
    <el-divider content-position="left">字段对应</el-divider>
    <p class="hint">
      左边是本系统的字段，右边选接口里对应的字段名。
      点「连通测试」后会自动匹配一批，也可以手工调整。
      <strong>「商品名称」必须映射</strong>，其余留空则该字段不导入。
    </p>

    <el-row :gutter="10">
      <el-col :span="12">
        <el-table :data="internalKeys().map(k => ({ k: k }))" size="small" border
                  max-height="260">
          <el-table-column prop="k" label="系统字段" width="110">
            <template #default="s">{{ internalLabel(s.row.k) }}</template>
          </el-table-column>
          <el-table-column label="接口字段">
            <template #default="s">
              <el-select :model-value="mappingOf(s.row.k)" size="small"
                         style="width:100%" clearable filterable allow-create
                         placeholder="不导入"
                         @change="v => setMapping(s.row.k, v)">
                <el-option v-for="f in rawFields" :key="f" :value="f" :label="f" />
              </el-select>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="map-help">
          <p class="hint" style="margin-bottom:8px">
            已映射 {{ mapped.length }} / {{ internalKeys().length }} 个字段
          </p>
          <p class="hint">
            若接口字段名没被自动识别，可以直接在下拉框里输入字段名，
            再按回车创建。输入的必须是接口返回 JSON 里的原始键名。
          </p>
          <p class="hint" style="margin-top:8px">
            若返回结构是多层嵌套（如 <code>data.list</code>），
            在上面「数据路径」里填进去即可，支持 <code>[0]</code> 取下标。
          </p>
        </el-card>
      </el-col>
    </el-row>

    <template #footer>
      <el-button @click="dlg = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存接口</el-button>
    </template>
  </el-dialog>
</div>
`),
};
