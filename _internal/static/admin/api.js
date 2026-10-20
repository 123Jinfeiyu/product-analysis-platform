/*
 * 接口封装 —— 全部走后端 Django 的 /api/*。
 *
 * 后端统一返回 {code, msg, data}：
 *   code=0   成功
 *   code=401 未登录
 *   code≠0   业务错误
 * 这里统一处理，业务代码只关心拿到的 data。
 */

async function request(cfg) {
    let resp;
    try {
        resp = await axios(Object.assign({ withCredentials: true }, cfg));
    } catch (e) {
        const d = e.response && e.response.data;
        if (e.response && e.response.status === 401) {
            window.__onUnauthorized && window.__onUnauthorized();
            throw new Error('未登录');
        }
        toast((d && d.msg) || e.message || '网络请求失败', 'error');
        throw e;
    }
    const body = resp.data;
    if (body.code !== 0) {
        toast(body.msg || '操作失败', 'error');
        throw new Error(body.msg);
    }
    return body.data;
}

/**
 * 上传文件。
 *
 * 为什么不复用 request()：request 默认 axios 会把对象转成 JSON 并设上
 * Content-Type: application/json。传 FormData 时必须让浏览器自己带
 * multipart 的 boundary，一旦手工设了 Content-Type，后端就解析不出文件。
 */
async function upload(url, formData) {
    let resp;
    try {
        resp = await axios({
            url: url, method: 'post', data: formData,
            withCredentials: true,
            // 不设 Content-Type，交给浏览器
        });
    } catch (e) {
        const d = e.response && e.response.data;
        if (e.response && e.response.status === 401) {
            window.__onUnauthorized && window.__onUnauthorized();
            throw new Error('未登录');
        }
        toast((d && d.msg) || e.message || '上传失败', 'error');
        throw e;
    }
    const body = resp.data;
    if (body.code !== 0) {
        // 导入失败属于业务结果，不是程序异常，交给调用方展示明细
        throw Object.assign(new Error(body.msg), { payload: body });
    }
    return body.data;
}

const API = {
    // ---------- 登录 ----------
    login: (d) => request({ url: '/api/login', method: 'post', data: d }),
    logout: () => request({ url: '/api/logout', method: 'post' }),
    currentUser: () => request({ url: '/api/current-user' }),

    // ---------- 概览 ----------
    stats: () => request({ url: '/api/stats' }),
    dashboard: (p) => request({ url: '/api/dashboard', params: p }),

    // ---------- 分析 ----------
    analysisPrice: (p) => request({ url: '/api/analysis/price', params: p }),
    analysisBrand: (p) => request({ url: '/api/analysis/brand', params: p }),
    analysisCategory: (p) => request({ url: '/api/analysis/category', params: p }),
    analysisDiscount: (p) => request({ url: '/api/analysis/discount', params: p }),
    analysisRanking: (p) => request({ url: '/api/analysis/ranking', params: p }),
    analysisTrend: (p) => request({ url: '/api/analysis/trend', params: p }),
    analysisKeyword: (p) => request({ url: '/api/analysis/keyword', params: p }),

    // ---------- 商品 ----------
    products: (p) => request({ url: '/api/products', params: p }),
    productCreate: (d) => request({ url: '/api/products/create', method: 'post', data: d }),
    productDetail: (id) => request({ url: '/api/products/' + id }),
    productUpdate: (id, d) => request({ url: '/api/products/' + id, method: 'put', data: d }),
    productDelete: (id) => request({ url: '/api/products/' + id, method: 'delete' }),
    productCopy: (id) => request({ url: '/api/products/' + id + '/copy', method: 'post' }),
    productBatchDelete: (ids) => request({
        url: '/api/products/batch_delete', method: 'post', data: { ids: ids },
    }),
    productBatchUpdate: (d) => request({
        url: '/api/products/batch_update', method: 'post', data: d,
    }),
    exportSummary: (p) => request({ url: '/api/products/export_summary', params: p }),

    // ---------- 上传 / 下载 ----------
    productImport: (file, update) => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('update', update ? '1' : '0');
        return upload('/api/products/import', fd);
    },
    importTemplateUrl: '/api/products/import/template',
    importFields: () => request({ url: '/api/products/import/fields', method: 'post' }),

    // ---------- 外部 API 数据源 ----------
    apiSources: (p) => request({ url: '/api/api_sources', params: p }),
    apiSourceSave: (d) => request({ url: '/api/api_sources/save', method: 'post', data: d }),
    apiSourceDelete: (id) => request({ url: '/api/api_sources/' + id, method: 'delete' }),
    apiSourceProbe: (d) => request({ url: '/api/api_sources/probe', method: 'post', data: d }),
    apiSourceFetch: (d) => request({ url: '/api/api_sources/fetch', method: 'post', data: d }),

    // ---------- 抓取 ----------
    vipProbe: (d) => request({ url: '/api/vip/probe', method: 'post', data: d }),
    vipCrawl: (d) => request({ url: '/api/vip/crawl', method: 'post', data: d }),
    runs: (p) => request({ url: '/api/runs', params: p }),

    // ---------- 浏览器环境（换电脑排查 / 显示隐藏） ----------
    browser: () => request({ url: '/api/browser', method: 'get' }),
    browserMode: (mode) => request({ url: '/api/browser/mode', method: 'post', data: { mode: mode } }),
    browserSelect: (path) => request({ url: '/api/browser/select', method: 'post', data: { path: path } }),

    // ---------- 采集任务（浏览器通道） ----------
    crawlStart: (d) => request({ url: '/api/crawl/start', method: 'post', data: d }),
    crawlStop: () => request({ url: '/api/crawl/stop', method: 'post' }),
    crawlStatus: (p) => request({ url: '/api/crawl/status', params: p }),

    // ---------- 维度与来源 ----------
    sources: (p) => request({ url: '/api/sources', params: p }),
    sourceDetail: (id) => request({ url: '/api/sources/' + id }),
    accounts: (p) => request({ url: '/api/accounts', params: p }),
    accountSave: (d) => request({ url: '/api/accounts', method: 'post', data: d }),
    accountDelete: (id) => request({ url: '/api/accounts/' + id, method: 'delete' }),
    brands: () => request({ url: '/api/brands' }),
    categories: () => request({ url: '/api/categories' }),

    // ---------- AI 助手（千问 / DeepSeek / 豆包） ----------
    aiProviders: () => request({ url: '/api/ai/providers' }),
    aiProviderSave: (d) => request({ url: '/api/ai/provider/save', method: 'post', data: d }),
    aiProviderTest: (d) => request({ url: '/api/ai/provider/test', method: 'post', data: d }),
    aiRecommend: (d) => request({ url: '/api/ai/recommend', method: 'post', data: d }),
    aiRecommendMark: (d) => request({ url: '/api/ai/recommend/mark', method: 'post', data: d }),
    aiInsight: (d) => request({ url: '/api/ai/insight', method: 'post', data: d }),
    aiCopy: (d) => request({ url: '/api/ai/copy', method: 'post', data: d }),
    aiRecords: (p) => request({ url: '/api/ai/records', params: p }),
};

window.API = API;

/*
 * CSV 导出：用原生表单跳转，不用 axios。
 * 后端返回的是文件流，axios 会把它当二进制处理，中文文件名还容易乱码。
 */
window.downloadCsv = function (params) {
    const q = new URLSearchParams();
    Object.keys(params || {}).forEach(k => {
        const v = params[k];
        if (v !== null && v !== undefined && v !== '') q.append(k, v);
    });
    const s = q.toString();
    window.location.href = '/api/products/export' + (s ? '?' + s : '');
};

/* 金额格式化，全站统一 */
window.fmtMoney = function (v) {
    if (v === null || v === undefined || v === '') return '-';
    return '¥' + Number(v).toFixed(2);
};