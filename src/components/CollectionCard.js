import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function CollectionCard({ collection, onClaim, isClaiming, showClaimAction, connected, }) {
    const { tokenId, name, description, imageSrc, isActive, isWhitelistEnabled, maxSupply, currentSupply, hasClaimed, isWhitelisted, isSvgFinalized, } = collection;
    const remaining = maxSupply === 0 ? "∞" : Math.max(maxSupply - currentSupply, 0);
    const canClaim = showClaimAction &&
        connected &&
        isActive &&
        isSvgFinalized &&
        (!isWhitelistEnabled || isWhitelisted) &&
        !hasClaimed &&
        (maxSupply === 0 || currentSupply < maxSupply);
    const reasons = [];
    if (!isActive)
        reasons.push("受付停止中");
    if (!isSvgFinalized)
        reasons.push("SVG未確定");
    if (isWhitelistEnabled && !isWhitelisted)
        reasons.push("ホワイトリスト対象外");
    if (hasClaimed)
        reasons.push("すでに受領済み");
    if (maxSupply !== 0 && currentSupply >= maxSupply)
        reasons.push("在庫なし");
    if (!connected)
        reasons.push("ウォレット未接続");
    const reasonText = reasons.length ? reasons.join(" / ") : undefined;
    return (_jsxs("div", { className: "collection-card card", children: [_jsx("div", { className: "thumb", children: imageSrc ? (_jsx("img", { src: imageSrc, alt: name })) : (_jsx("div", { style: {
                        display: "grid",
                        placeItems: "center",
                        height: "100%",
                        color: "var(--muted)",
                        fontWeight: 700,
                    }, children: "SVG \u6E96\u5099\u4E2D" })) }), _jsxs("div", { className: "collection-meta", children: [_jsxs("span", { className: "tag", children: ["ID #", tokenId] }), _jsxs("span", { className: "tag", children: ["\u92F3\u9020\u6E08\u307F ", currentSupply] }), _jsxs("span", { className: "tag", children: ["\u6B8B\u308A ", remaining, " / ", maxSupply === 0 ? "∞" : maxSupply] }), _jsx("span", { className: `tag ${isActive ? "success" : "danger"}`, children: isActive ? "受付中" : "停止中" }), isWhitelistEnabled ? (_jsx("span", { className: "tag warn", children: "\u30DB\u30EF\u30A4\u30C8\u30EA\u30B9\u30C8" })) : (_jsx("span", { className: "tag success", children: "\u8AB0\u3067\u3082" })), hasClaimed ? _jsx("span", { className: "tag success", children: "\u53D7\u9818\u6E08\u307F" }) : null] }), _jsxs("div", { children: [_jsx("h3", { style: { margin: "0 0 6px", fontSize: 18 }, children: name }), _jsx("p", { className: "collection-desc", children: description }), _jsx("div", { className: "status-line", children: isWhitelistEnabled ? (_jsx("span", { className: "tag", children: isWhitelisted
                                ? "リスト入り"
                                : connected
                                    ? "リスト外"
                                    : "接続して確認" })) : null })] }), showClaimAction ? (_jsxs("div", { className: "actions-row", children: [_jsxs("div", { className: "status-line", children: [_jsx("span", { role: "img", "aria-label": "nft", children: "\uD83C\uDF81" }), "1 \u30A2\u30AB\u30A6\u30F3\u30C8 1 \u70B9\u306E\u307F"] }), _jsx("button", { className: "btn", disabled: !canClaim || isClaiming, onClick: () => onClaim?.(tokenId), children: hasClaimed
                            ? "受領済み"
                            : !connected
                                ? "接続が必要"
                                : isClaiming
                                    ? "送信中…"
                                    : isWhitelistEnabled && !isWhitelisted
                                        ? "対象外"
                                        : "受け取る" })] })) : null] }));
}
