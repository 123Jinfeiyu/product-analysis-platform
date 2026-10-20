/*
 * 商品分析平台 —— 前端总装
 *
 * 技术栈：Vue3 (global build) + Element Plus + ECharts + Axios
 *
 * 【重要】为什么拆成几个文件而不是一个巨型 app.js：
 *   之前单文件 900+ 行、模板字符串 2 万字符，
 *   Vue 运行时编译时抛 "Invalid or unexpected token"，
 *   而报错位置完全指不到真正的代码行，排查成本极高。
 *   拆开后每段模板都很短，出错能定位到具体文件。
 *
 * 拆法：
 *   api.js         —— 所有接口封装
 *   charts.js      —— ECharts 封装（懒初始化）
 *   views/*.js     —— 每个菜单一个组件对象（模板 + 逻辑）
 *   app.js         —— 总装 + 路由 + 登录
 */
// 这几个脚本共享全局作用域，Vue 的 API 必须各用各的别名，
// 否则后面加载的文件会报 "Identifier 'ref' has already been declared"。
const createApp = Vue.createApp;
const ARef = Vue.ref;
const AReactive = Vue.reactive;
const AComputed = Vue.computed;
const AMounted = Vue.onMounted;

// 全局提示组件挂在 window 上，各视图直接用
const toast = (msg, type) => {
    if (type === 'error') ElementPlus.ElMessage.error(msg);
    else if (type === 'warn') ElementPlus.ElMessage.warning(msg);
    else ElementPlus.ElMessage.success(msg);
};
window.toast = toast;

const app = createApp({
    setup() {
        // ---------- 登录态 ----------
        const logged = ARef(false);
        const user = ARef({});
        const loginForm = AReactive({ username: 'admin', password: '' });
        const loginBusy = ARef(false);

        async function doLogin() {
            if (!loginForm.username || !loginForm.password) {
                return toast('请输入用户名和密码', 'warn');
            }
            loginBusy.value = true;
            try {
                const d = await API.login({
                    username: loginForm.username,
                    password: loginForm.password,
                });
                user.value = d || {};
                logged.value = true;
                toast('登录成功');
                await loadMenuData();
            } catch (e) {
                // 错误提示已在 api.js 统一弹过
            } finally {
                loginBusy.value = false;
            }
        }

        async function doLogout() {
            try { await API.logout(); } catch (e) { /* 忽略 */ }
            logged.value = false;
            user.value = {};
        }

async function checkLogin() {
    try {
        const d = await API.currentUser();
        if (d && d.username) {
            user.value = d;
            logged.value = true;
            await loadMenuData();
            return;
        }
    } catch (e) { /* 401 由 api.js 处理 */ }
    logged.value = false;
}

// 会话失效时把界面切回登录页
window.__onUnauthorized = function () {
    logged.value = false;
    user.value = {};
};

        // ---------- 菜单 ----------
        //
        // 用户明确要求：「新增数据/调接口」和「爬虫」这类功能先藏起来。
        // 处理方式是**隐藏而不是删除**：
        //   - 只把入口从侧栏拿掉，路由、视图、接口、组件全部保留
        //   - 需要时点侧栏底部的「显示全部功能」一键恢复
        // 这样交付给终端用户时界面干净，但功能一个都没丢，
        // 哪天用户又要采集了，点一下就回来了，不用重新开发。
        const activeMenu = ARef('dashboard');

        // 始终显示的核心菜单
        const menus = [
            { key: 'dashboard', label: '分析看板', comp: 'DashboardView' },
            { key: 'products', label: '商品管理', comp: 'ProductView' },
            { key: 'analysis', label: '维度分析', comp: 'AnalysisView' },
            { key: 'ai', label: 'AI 助手', comp: 'AiView' },
        ];

        // 默认隐藏的功能（按用户要求）
        const hiddenMenus = [
            { key: 'crawl', label: '数据采集', comp: 'CrawlView' },
            { key: 'apisources', label: '数据接口', comp: 'ApiSourceView' },
            { key: 'ranking', label: '商品排行', comp: 'RankingView' },
            { key: 'runs', label: '抓取记录', comp: 'RunView' },
            { key: 'sources', label: '来源管理', comp: 'SourceView' },
            { key: 'accounts', label: '登录账号', comp: 'AccountView' },
        ];

        // 「显示全部功能」的开关状态。
        // 存 localStorage 而不是内存变量 —— 否则用户每次重开程序都要再点一次，
        // 那这个开关就等于没用。
        const SHOW_ALL_KEY = 'pa_show_all_menus';
        const showAll = ARef(localStorage.getItem(SHOW_ALL_KEY) === '1');

        // 实际渲染到侧栏的菜单
        const visibleMenus = AComputed(function () {
            return showAll.value ? menus.concat(hiddenMenus) : menus;
        });

        function toggleShowAll() {
            showAll.value = !showAll.value;
            try {
                localStorage.setItem(SHOW_ALL_KEY, showAll.value ? '1' : '0');
            } catch (e) { /* 隐私模式下 localStorage 可能不可写，忽略 */ }
            // 收起状态下如果正停在被隐藏的页面上，先退回看板，否则会出现空白
            if (!showAll.value) {
                const onHidden = hiddenMenus.some(m => m.key === activeMenu.value);
                const onVisible = menus.some(m => m.key === activeMenu.value);
                if (onHidden || !onVisible) activeMenu.value = 'dashboard';
            }
        }

        // 下拉框用的维度数据
        const brands = ARef([]);
        const categories = ARef([]);

        async function loadMenuData() {
            try {
                const [b, c] = await Promise.all([
                    API.brands().catch(() => null),
                    API.categories().catch(() => null),
                ]);
                if (b && b.items) brands.value = b.items;
                if (c && c.items) categories.value = c.items;
            } catch (e) { /* 忽略 */ }
        }

        // ---------- 当前视图 ----------
        //
        // 不用 <component :is>，改成 v-if 显式列举。
        // 原因：<component :is> 切换时会卸载旧组件，
        // 图表组件的 onBeforeUnmount 里 dispose 会连带抛
        // "Cannot read properties of null (reading 'shapeFlag')"，
        // 严重时整个界面卡在空白（shapeFlag / subTree 报错就是这么来的）。
        // v-if 虽然啰嗦点，但切换行为完全可控。
        function onMenuSelect(k) {
            activeMenu.value = k;
        }

        AMounted(checkLogin);

        // 模板里用到的全局函数必须从 setup 显式返回 ——
        // Vue3 不会去 window 上找，漏了就报 "xxx is not a function"。
        return {
            logged, user, loginForm, loginBusy,
            doLogin, doLogout,
            menus, hiddenMenus, visibleMenus, showAll, toggleShowAll,
            activeMenu, onMenuSelect,
            fmtMoney: window.fmtMoney,
        };
    },

    template: `
<div class="root">
  <div v-if="!logged" class="login-wrap">
    <el-card class="login-card" shadow="always">
      <h2 class="login-title">商品分析平台</h2>
      <p class="login-sub">唯品会商品数据分析</p>
      <el-form label-width="70px" @submit.prevent="doLogin">
        <el-form-item label="账号">
          <el-input v-model="loginForm.username" placeholder="用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" show-password
                    placeholder="密码" @keyup.enter="doLogin" />
        </el-form-item>
        <el-button type="primary" class="login-btn" :loading="loginBusy"
                   @click="doLogin">登 录</el-button>
      </el-form>
      <p class="login-tip">默认账号 admin / admin888</p>
    </el-card>
  </div>

  <el-container v-else class="layout">
    <el-header class="top-bar">
      <div class="brand">商品分析平台</div>
      <div class="spacer"></div>
      <span class="who">{{ user.username }}</span>
      <el-button link type="primary" @click="doLogout">退出</el-button>
    </el-header>
    <el-container>
      <el-aside width="180px" class="side">
        <el-menu :default-active="activeMenu" @select="onMenuSelect">
          <el-menu-item v-for="m in visibleMenus" :key="m.key" :index="m.key">
            {{ m.label }}
          </el-menu-item>
        </el-menu>

        <!--
          显示全部功能：默认收起。
          爬虫、接口接入这些要浏览器和 API Key，对只想看数据的用户是干扰，
          所以默认藏起来，但保留一键恢复的入口 —— 功能没删，只是收起来了。
        -->
        <div class="side-toggle" @click="toggleShowAll">
          {{ showAll ? '隐藏数据采集与接口' : '显示全部功能（' + hiddenMenus.length + '）' }}
        </div>
      </el-aside>
      <el-main class="main">
        <DashboardView     v-if="activeMenu==='dashboard'" />
        <ProductView       v-else-if="activeMenu==='products'" />
        <CrawlView         v-else-if="activeMenu==='crawl'" />
        <ApiSourceView     v-else-if="activeMenu==='apisources'" />
        <AnalysisView      v-else-if="activeMenu==='analysis'" />
        <AiView            v-else-if="activeMenu==='ai'" />
        <RankingView       v-else-if="activeMenu==='ranking'" />
        <RunView           v-else-if="activeMenu==='runs'" />
        <SourceView        v-else-if="activeMenu==='sources'" />
        <AccountView       v-else-if="activeMenu==='accounts'" />
      </el-main>
    </el-container>
  </el-container>
</div>
`,
});

// 视图组件都挂在 window 上（views.js 里 window.DashboardView = {...}），
// Vue 的模板编译器**不会**自动去 window 上找同名标识符，
// 必须显式注册，否则 <DashboardView /> 会被当成未知原生元素，静默渲染成空。
app.component('DashboardView', window.DashboardView);
app.component('RankingView', window.RankingView);
app.component('ProductView', window.ProductView);
app.component('CrawlView', window.CrawlView);
app.component('ApiSourceView', window.ApiSourceView);
app.component('AnalysisView', window.AnalysisView);
app.component('AiView', window.AiView);
app.component('AccountView', window.AccountView);
app.component('SourceView', window.SourceView);
app.component('RunView', window.RunView);

app.use(ElementPlus);
app.mount('#app');
window.__app = app;