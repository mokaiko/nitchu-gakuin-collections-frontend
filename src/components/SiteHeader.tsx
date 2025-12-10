type HeaderProps = {
  onConnect?: () => void;
  account?: string;
  isConnecting?: boolean;
  onDisconnect?: () => void;
};

export function SiteHeader({ onConnect, account, isConnecting, onDisconnect }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="container inner">
        <div className="brand">
          <a href="https://www.rizhong.org/" target="_blank" rel="noreferrer">
            <img src="https://www.rizhong.org/wp-content/themes/niccyu/images/theme/logo.png" alt="日中学院" />
          </a>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {onConnect ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={onConnect} disabled={isConnecting}>
                {isConnecting ? '接続中…' : account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'MetaMask 接続'}
              </button>
              {account && onDisconnect ? (
                <button className="btn" style={{ padding: '10px 12px', background: '#d9dde6', color: '#333' }} onClick={onDisconnect}>
                  切断
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
