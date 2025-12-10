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
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <h5>日中学院</h5>
            <p>
              〒112-0004 東京都文京区後楽1-5-3
              <br />
              TEL：03-3814-3591　FAX：03-3814-3590
            </p>
          </div>
          <ul className="footer-links">
            {footerLinks.map((item) => (
              <li key={item.href}>
                <a href={item.href} target="_blank" rel="noreferrer">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="footer-bottom">
          <div>Copyright© 2007 NITTYUU GAKUIN All Rights Reserved</div>
        </div>
      </div>
    </footer>
  );
}
