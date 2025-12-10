import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const footerLinks = [
    { label: '中国語別科', href: 'https://www.rizhong.org/part-time' },
    { label: '中国語本科', href: 'https://www.rizhong.org/core' },
    { label: '中国語本科研究科', href: 'https://www.rizhong.org/graduate' },
    { label: '日本語科', href: 'https://www.rizhong.org/japanese' },
    { label: '企業内研修', href: 'https://www.rizhong.org/private' },
    { label: '学院案内', href: 'https://www.rizhong.org/info' },
    { label: 'アクセス', href: 'https://www.rizhong.org/access' },
    { label: 'サイトマップ', href: 'https://www.rizhong.org/sitemap' },
    { label: 'プライバシーポリシー', href: 'https://www.rizhong.org/privacypolicy' }
];
export function SiteFooter() {
    return (_jsx("footer", { className: "site-footer", children: _jsxs("div", { className: "container footer-inner", children: [_jsxs("div", { className: "footer-top", children: [_jsxs("div", { className: "footer-brand", children: [_jsx("h5", { children: "\u65E5\u4E2D\u5B66\u9662" }), _jsxs("p", { children: ["\u3012112-0004 \u6771\u4EAC\u90FD\u6587\u4EAC\u533A\u5F8C\u697D1-5-3", _jsx("br", {}), "TEL\uFF1A03-3814-3591\u3000FAX\uFF1A03-3814-3590"] })] }), _jsx("ul", { className: "footer-links", children: footerLinks.map((item) => (_jsx("li", { children: _jsx("a", { href: item.href, target: "_blank", rel: "noreferrer", children: item.label }) }, item.href))) })] }), _jsx("div", { className: "footer-bottom", children: _jsx("div", { children: "Copyright\u00A9 2007 NITTYUU GAKUIN All Rights Reserved" }) })] }) }));
}
