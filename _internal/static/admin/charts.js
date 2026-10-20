/*
 * ECharts 封装（Composition API 工厂函数版）。
 *
 * 为什么用工厂函数而不是返回对象字面量：
 *   对象字面量里方法名必须叫 onMounted/onBeforeUnmount，Vue 才认。
 *   而本文件要和 views.js / app.js 共享全局作用域，
 *   大家都在解构 Vue.ref 会撞 "Identifier 'ref' has already been declared"。
 *   工厂函数直接闭包引用 Vue.xxx，问题消失，也更符合 Vue3 写法。
 *
 * 懒初始化：只有容器真的渲染出来才 init，避免在空 DOM 上初始化出空白图。
 */

const CHART_PALETTE = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399',
                       '#00d4ff', '#c23531', '#d48d21'];

function chartBase(extra) {
    return Object.assign({
        color: CHART_PALETTE,
        textStyle: { color: '#606266', fontSize: 12 },
        grid: { left: 50, right: 30, top: 40, bottom: 40, containLabel: true },
    }, extra || {});
}

/* 底层：所有图表类型的公共外壳 */
function useChart() {
    const holder = Vue.ref(null);      // 真实 DOM 容器，由模板的 :ref 回调 bind() 填进来
    let chart = null;
    let lastOption = null;             // 最近一次 set 的配置，容器换了之后要重放

    /*
     * 模板里必须这样写：
     *     <div :ref="el => chart.bind(el)"></div>
     * 不能写 ref="chart.el" —— Vue3 只把字符串 ref 收集到 $refs，
     * 写成点号形式会被当成普通字符串，DOM 永远绑不上，
     * 于是 echarts.init(null) 静默失败，页面上一个 canvas 都没有。
     */
    function bind(el) {
        const next = el || null;
        if (holder.value === next) return;
        holder.value = next;

        // 旧容器的实例必须丢掉：DOM 已经换了，chart 指向它就等于指向一个游离节点
        if (chart) {
            try { chart.dispose(); } catch (e) { /* 容器已被移除时 dispose 会抛，忽略 */ }
            chart = null;
        }

        // 关键：容器换新之后立刻用新 DOM 重建，并把上一份配置重放一遍。
        // 不这么做的话，v-if 切页签回来的那一刻，页面是「有容器、有数据、没图」——
        // 因为组件 onMounted 时 init 过一次，切走后 chart 被 dispose，
        // 切回来只有 DOM 没有 chart 实例，而之前 set 的 option 也没人再画一遍。
        if (holder.value && lastOption) {
            Vue.nextTick(function () {
                if (!holder.value) return;
                if (chart) { try { chart.dispose(); } catch (e) {} chart = null; }
                chart = echarts.init(holder.value);
                chart.setOption(lastOption, true);
            });
        }
    }

    function init() {
        if (!holder.value) return;
        if (chart) chart.dispose();
        chart = echarts.init(holder.value);
    }
    function set(option, notMerge) {
        lastOption = option;
        if (!chart) init();
        if (chart) chart.setOption(option, notMerge === true);
    }
    function onResize() { if (chart) chart.resize(); }

    Vue.onMounted(function () {
        // 等 DOM 真正就位再初始化
        Vue.nextTick(function () {
            init();
            window.addEventListener('resize', onResize);
        });
    });
    Vue.onBeforeUnmount(function () {
        window.removeEventListener('resize', onResize);
        if (chart) { try { chart.dispose(); } catch (e) {} chart = null; }
        lastOption = null;
    });

    return { bind: bind, set: set, init: init };
}

/* 横向柱状图：品牌排名这种名字长的 */
window.barChart = function (opt) {
    opt = opt || {};
    const c = useChart();
    return Object.assign(c, {
        render(rows, field, labelField) {
            const d = (rows || []).slice(0, opt.limit || 10);
            c.set(chartBase({
                grid: { left: 110, right: 40, top: 20, bottom: 30, containLabel: true },
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                legend: { show: false },
                xAxis: { type: 'value' },
                yAxis: {
                    type: 'category',
                    data: d.map(r => r[labelField || 'brand_name']).reverse(),
                    axisLabel: { width: 96, overflow: 'truncate' },
                },
                series: [{
                    type: 'bar',
                    data: d.map(r => r[field]).reverse(),
                    itemStyle: { color: opt.color || '#409eff', borderRadius: [0, 4, 4, 0] },
                    barMaxWidth: 20,
                }],
            }));
        },
    });
};

/* 饼图：占比 */
window.pieChart = function (opt) {
    opt = opt || {};
    const c = useChart();
    return Object.assign(c, {
        render(rows, field, labelField) {
            c.set(chartBase({
                tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                legend: { show: true, bottom: 0, type: 'scroll' },
                series: [{
                    type: 'pie',
                    radius: ['38%', '62%'],
                    center: ['50%', '44%'],
                    data: (rows || []).map(r => ({
                        name: r[labelField || 'brand_name'], value: r[field],
                    })),
                    label: { formatter: '{b}\n{d}%' },
                }],
            }));
        },
    });
};

/* 折线图：趋势 */
window.lineChart = function (opt) {
    opt = opt || {};
    const c = useChart();
    return Object.assign(c, {
        render(rows, field, labelField) {
            c.set(chartBase({
                tooltip: { trigger: 'axis' },
                legend: { show: false },
                xAxis: {
                    type: 'category',
                    data: (rows || []).map(r => r[labelField || 'day']),
                },
                yAxis: { type: 'value' },
                series: [{
                    type: 'line', smooth: true,
                    data: (rows || []).map(r => r[field]),
                    areaStyle: { opacity: 0.15 },
                    itemStyle: { color: opt.color || '#409eff' },
                }],
            }));
        },
    });
};

/* 竖向柱状图：价格带、折扣档这种有序分类 */
window.vbarChart = function (opt) {
    opt = opt || {};
    const c = useChart();
    return Object.assign(c, {
        render(rows, field, labelField) {
            c.set(chartBase({
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                legend: { show: false },
                xAxis: {
                    type: 'category',
                    data: (rows || []).map(r => r[labelField || 'band']),
                    axisLabel: { interval: 0, rotate: opt.rotate || 0 },
                },
                yAxis: { type: 'value' },
                series: [{
                    type: 'bar',
                    data: (rows || []).map(r => r[field]),
                    itemStyle: { color: opt.color || '#67c23a', borderRadius: [4, 4, 0, 0] },
                    barMaxWidth: 44,
                }],
            }));
        },
    });
};