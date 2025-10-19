const l = {
  x: {
    name: "x",
    label: "X",
    getShareUrl: (e) => {
      const t = new URLSearchParams();
      return e.url && t.set("url", e.url), e.text && t.set("text", e.text), e.hashtags?.length && t.set("hashtags", e.hashtags.join(",")), e.via && t.set("via", e.via), `https://x.com/intent/tweet?${t.toString()}`;
    },
    color: "#000000"
  },
  bluesky: {
    name: "bluesky",
    label: "Bluesky",
    getShareUrl: (e) => {
      const t = [e.text, e.url].filter(Boolean).join(`

`), o = new URLSearchParams();
      return t && o.set("text", t), `https://bsky.app/intent/compose?${o.toString()}`;
    },
    color: "#1185fe"
  },
  threads: {
    name: "threads",
    label: "Threads",
    getShareUrl: (e) => {
      const t = [e.text, e.url].filter(Boolean).join(`

`), o = new URLSearchParams();
      return t && o.set("text", t), `https://www.threads.net/intent/post?${o.toString()}`;
    },
    color: "#000000"
  },
  mastodon: {
    name: "mastodon",
    label: "Mastodon",
    getShareUrl: (e) => {
      const t = [e.text, e.url].filter(Boolean).join(`

`), o = new URLSearchParams();
      return t && o.set("text", t), `https://mastodon.social/share?${o.toString()}`;
    },
    color: "#6364ff"
  },
  facebook: {
    name: "facebook",
    label: "Facebook",
    getShareUrl: (e) => {
      const t = new URLSearchParams();
      return e.url && t.set("u", e.url), `https://www.facebook.com/sharer/sharer.php?${t.toString()}`;
    },
    color: "#0866FF"
  },
  linkedin: {
    name: "linkedin",
    label: "LinkedIn",
    getShareUrl: (e) => {
      const t = new URLSearchParams();
      return e.url && t.set("url", e.url), `https://www.linkedin.com/sharing/share-offsite/?${t.toString()}`;
    },
    color: "#0077b5"
  },
  reddit: {
    name: "reddit",
    label: "Reddit",
    getShareUrl: (e) => {
      const t = new URLSearchParams();
      return e.url && t.set("url", e.url), e.title && t.set("title", e.title), `https://www.reddit.com/submit?${t.toString()}`;
    },
    color: "#ff4500"
  },
  telegram: {
    name: "telegram",
    label: "Telegram",
    getShareUrl: (e) => {
      const t = new URLSearchParams();
      return e.url && t.set("url", e.url), e.text && t.set("text", e.text), `https://t.me/share/url?${t.toString()}`;
    },
    color: "#0088cc"
  },
  whatsapp: {
    name: "whatsapp",
    label: "WhatsApp",
    getShareUrl: (e) => {
      const t = [e.text, e.url].filter(Boolean).join(" "), o = new URLSearchParams();
      return t && o.set("text", t), `${/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "whatsapp://send" : "https://web.whatsapp.com/send"}?${o.toString()}`;
    },
    color: "#25d366"
  },
  email: {
    name: "email",
    label: "Email",
    getShareUrl: (e) => {
      const t = e.title || e.text || "", o = [e.description, e.url].filter(Boolean).join(`

`), r = new URLSearchParams();
      return t && r.set("subject", t), o && r.set("body", o), `mailto:?${r.toString()}`;
    },
    color: "#7f7f7f"
  },
  pinterest: {
    name: "pinterest",
    label: "Pinterest",
    getShareUrl: (e) => {
      const t = new URLSearchParams();
      return e.url && t.set("url", e.url), e.media && t.set("media", e.media), e.description && t.set("description", e.description), `https://pinterest.com/pin/create/button/?${t.toString()}`;
    },
    color: "#bd081c"
  },
  copy: {
    name: "copy",
    label: "Copy",
    getShareUrl: (e) => e.url || window.location.href,
    color: "#6c757d"
  }
}, c = ["x", "facebook", "whatsapp"], a = (e) => l[e], h = {
  platforms: c,
  theme: "light",
  nativeShare: !1,
  popup: !0,
  popupWidth: 550,
  popupHeight: 420,
  copiedDuration: 2e3
};
class p {
  options;
  container = null;
  widget = null;
  shareData;
  constructor(t = {}) {
    this.options = { ...h, ...t }, this.shareData = this.getDefaultShareData(), this.options.customPlatforms && this.options.customPlatforms.forEach((o) => {
      l[o.name] = o;
    }), this.init();
  }
  init() {
    if (this.options.container ? typeof this.options.container == "string" ? this.container = document.querySelector(this.options.container) : this.container = this.options.container : this.container = document.body, !this.container)
      throw new Error("SocialShareButtons: Container not found");
    this.createWidget(), this.attachEventListeners(), this.updateTheme();
  }
  getDefaultShareData() {
    const t = (o) => document.querySelector(`meta[property="${o}"], meta[name="${o}"]`)?.getAttribute("content") || void 0;
    return {
      url: window.location.href,
      title: document.title,
      description: t("og:description") || t("description"),
      media: t("og:image")
    };
  }
  createWidget() {
    const t = document.createElement("div");
    t.className = `social-share ${this.options.className || ""}`, t.setAttribute("role", "region"), t.setAttribute("aria-label", this.options.ariaLabel || "Social sharing buttons"), t.setAttribute("data-theme", this.options.theme || "auto");
    const o = document.createElement("div");
    o.className = "social-share-buttons", this.options.platforms?.forEach((r) => {
      const i = a(r);
      if (!i) return;
      const s = this.createButton(i.name, i.label);
      o.appendChild(s);
    }), t.appendChild(o), this.container?.appendChild(t), this.widget = t;
  }
  createButton(t, o) {
    const r = document.createElement("button");
    r.className = "social-share-button", r.setAttribute("data-platform", t), r.setAttribute("type", "button"), r.setAttribute("aria-label", `Share on ${o}`);
    const s = this.options.labels?.[t] || o;
    r.textContent = s;
    const n = a(t);
    return n?.color && r.style.setProperty("--social-share-buttons-color", n.color), r;
  }
  attachEventListeners() {
    this.widget?.addEventListener("click", this.handleClick.bind(this)), this.options.theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => this.updateTheme());
  }
  async handleClick(t) {
    const r = t.target.closest("[data-platform]");
    if (!r) return;
    t.preventDefault();
    const i = r.getAttribute("data-platform");
    await this.share(i, this.shareData);
  }
  async share(t, o) {
    const r = { ...this.shareData, ...o };
    if (this.options.nativeShare && t !== "copy" && this.canUseNativeShare())
      return this.shareNative(r);
    if (t === "copy")
      return this.copyToClipboard(r.url || window.location.href);
    const i = a(t);
    if (!i)
      return console.warn(`SocialShareButtons: Platform "${t}" not found`), !1;
    const s = i.getShareUrl(r);
    return this.options.popup ? this.openPopup(s) : window.open(s, "_blank", "noopener,noreferrer"), this.options.onShare?.(t, !0), !0;
  }
  openPopup(t) {
    const o = this.options.popupWidth || 550, r = this.options.popupHeight || 420, i = (window.innerWidth - o) / 2 + window.screenX, s = (window.innerHeight - r) / 2 + window.screenY, n = `width=${o},height=${r},left=${i},top=${s},scrollbars=yes,resizable=yes`;
    window.open(t, "share-popup", n);
  }
  async shareNative(t) {
    if (!this.canUseNativeShare())
      return console.warn("SocialShareButtons: Native share API not available"), !1;
    const o = { ...this.shareData, ...t };
    try {
      return await navigator.share({
        title: o.title,
        text: o.text || o.description,
        url: o.url
      }), this.options.onShare?.("native", !0), !0;
    } catch (r) {
      return r.name !== "AbortError" && console.error("SocialShareButtons: Native share failed", r), !1;
    }
  }
  canUseNativeShare() {
    return "share" in navigator && navigator.canShare !== void 0;
  }
  async copyToClipboard(t) {
    try {
      if (navigator.clipboard && window.isSecureContext)
        await navigator.clipboard.writeText(t);
      else {
        const r = document.createElement("textarea");
        r.value = t, r.style.position = "fixed", r.style.opacity = "0", document.body.appendChild(r), r.select(), document.execCommand("copy"), document.body.removeChild(r);
      }
      const o = this.widget?.querySelector('[data-platform="copy"]');
      if (o) {
        const r = o.innerHTML, i = this.options.labels?.copied || "Copied!";
        o.innerHTML = i, setTimeout(() => {
          o.innerHTML = r;
        }, this.options.copiedDuration || 2e3);
      }
      return this.options.onShare?.("copy", !0), !0;
    } catch (o) {
      return console.error("SocialShareButtons: Copy to clipboard failed", o), !1;
    }
  }
  updateTheme() {
    if (this.widget)
      if (this.options.theme === "auto") {
        const t = window.matchMedia("(prefers-color-scheme: dark)").matches;
        this.widget.setAttribute("data-theme", t ? "dark" : "light");
      } else
        this.widget.setAttribute("data-theme", this.options.theme || "light");
  }
  updateOptions(t) {
    this.options = { ...this.options, ...t }, this.widget && (this.widget.remove(), this.createWidget(), this.updateTheme());
  }
  destroy() {
    this.widget && (this.widget.remove(), this.widget = null);
  }
}
export {
  p as SocialShareButtons,
  p as default,
  c as defaultPlatforms,
  a as getPlatform,
  l as platforms
};
//# sourceMappingURL=social-share-buttons.js.map
