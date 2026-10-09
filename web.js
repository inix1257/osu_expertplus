// ==UserScript==
// @name osu!web enhancement
// @namespace http://tampermonkey.net/
// @version 0.7.0
// @description Some small improvements to osu!web, featuring beatmapset filter and profile page improvement.
// @author VoltaXTY
// @match https://osu.ppy.sh/*
// @match https://lazer.ppy.sh/*
// @icon http://ppy.sh/favicon.ico
// @grant none
// @run-at document-end
// @downloadURL https://update.greasyfork.org/scripts/475417/osu%21web%20enhancement.user.js
// @updateURL https://update.greasyfork.org/scripts/475417/osu%21web%20enhancement.meta.js
// ==/UserScript==
// below are source code from http://i18njs.com/js/i18n.js
(function() {
  var Translator, i18n, translator,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  Translator = (function() {
    function Translator() {
      this.translate = __bind(this.translate, this);      this.data = {
        values: {},
        contexts: []
      };
      this.globalContext = {};
    }
    Translator.prototype.translate = function(text, defaultNumOrFormatting, numOrFormattingOrContext, formattingOrContext, context) {
      var defaultText, formatting, isObject, num;
      if (context == null) {
        context = this.globalContext;
      }
      isObject = function(obj) {
        var type;
        type = typeof obj;
        return type === "function" || type === "object" && !!obj;
      };
      if (isObject(defaultNumOrFormatting)) {
        defaultText = null;
        num = null;
        formatting = defaultNumOrFormatting;
        context = numOrFormattingOrContext || this.globalContext;
      } else {
        if (typeof defaultNumOrFormatting === "number") {
          defaultText = null;
          num = defaultNumOrFormatting;
          formatting = numOrFormattingOrContext;
          context = formattingOrContext || this.globalContext;
        } else {
          defaultText = defaultNumOrFormatting;
          if (typeof numOrFormattingOrContext === "number") {
            num = numOrFormattingOrContext;
            formatting = formattingOrContext;
            context = context;
          } else {
            num = null;
            formatting = numOrFormattingOrContext;
            context = formattingOrContext || this.globalContext;
          }
        }
      }
      if (isObject(text)) {
        if (isObject(text['i18n'])) {
          text = text['i18n'];
        }
        return this.translateHash(text, context);
      } else {
        return this.translateText(text, num, formatting, context, defaultText);
      }
    };
    Translator.prototype.add = function(d) {
      var c, k, v, _i, _len, _ref, _ref1, _results;
      if ((d.values != null)) {
        _ref = d.values;
        for (k in _ref) {
          v = _ref[k];
          this.data.values[k] = v;
        }
      }
      if ((d.contexts != null)) {
        _ref1 = d.contexts;
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          c = _ref1[_i];
          _results.push(this.data.contexts.push(c));
        }
        return _results;
      }
    };
    Translator.prototype.setContext = function(key, value) {
      return this.globalContext[key] = value;
    };
    Translator.prototype.clearContext = function(key) {
      return this.lobalContext[key] = null;
    };
    Translator.prototype.reset = function() {
      this.data = {
        values: {},
        contexts: []
      };
      return this.globalContext = {};
    };
    Translator.prototype.resetData = function() {
      return this.data = {
        values: {},
        contexts: []
      };
    };
    Translator.prototype.resetContext = function() {
      return this.globalContext = {};
    };
    Translator.prototype.translateHash = function(hash, context) {
      var k, v;

      for (k in hash) {
        v = hash[k];
        if (typeof v === "string") {
          hash[k] = this.translateText(v, null, null, context);
        }
      }
      return hash;
    };
    Translator.prototype.translateText = function(text, num, formatting, context, defaultText) {
      var contextData, result;
      if (context == null) { context = this.globalContext; }
      if (this.data == null) { return this.useOriginalText(defaultText || text, num, formatting); }
      contextData = this.getContextData(this.data, context);
      if (contextData != null) { result = this.findTranslation(text, num, formatting, contextData.values, defaultText); }
      if (result == null) { result = this.findTranslation(text, num, formatting, this.data.values, defaultText); }
      if (result == null) { return this.useOriginalText(defaultText || text, num, formatting); }
      return result;
    };
    Translator.prototype.findTranslation = function(text, num, formatting, data) {
      var result, triple, value, _i, _len;
      value = data[text];
      if (value == null) { return null; }
      if (num == null) {
        if (typeof value === "string") { return this.applyFormatting(value, num, formatting); }
      } else {
        if (value instanceof Array || value.length) {
          for (_i = 0, _len = value.length; _i < _len; _i++) {
            triple = value[_i];
            if ((num >= triple[0] || triple[0] === null) && (num <= triple[1] || triple[1] === null)) {
              result = this.applyFormatting(triple[2].replace("-%n", String(-num)), num, formatting);
              return this.applyFormatting(result.replace("%n", String(num)), num, formatting);
            }
          }
        }
      }
      return null;
    };
    Translator.prototype.getContextData = function(data, context) {
      var c, equal, key, value, _i, _len, _ref, _ref1;
      if (data.contexts == null) { return null; }
      _ref = data.contexts;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        c = _ref[_i];
        equal = true;
        _ref1 = c.matches;
        for (key in _ref1) {
          value = _ref1[key];
          equal = equal && value === context[key];
        }
        if (equal) { return c; }
      }
      return null;
    };
    Translator.prototype.useOriginalText = function(text, num, formatting) {
      if (num == null) {
        return this.applyFormatting(text, num, formatting);
      }
      return this.applyFormatting(text.replace("%n", String(num)), num, formatting);
    };
    Translator.prototype.applyFormatting = function(text, num, formatting) {
      var ind, regex;
      for (ind in formatting) {
        regex = new RegExp("%{" + ind + "}", "g");
        text = text.replace(regex, formatting[ind]);
      }
      return text;
    };
    return Translator;
  })();
  translator = new Translator();
  i18n = translator.translate;
  i18n.translator = translator;
  i18n.create = function(data) {
    var trans;
    trans = new Translator();
    if (data != null) {
      trans.add(data);
    }
    trans.translate.create = i18n.create;
    return trans.translate;
  };
  (typeof module !== "undefined" && module !== null ? module.exports = i18n : void 0) || (this.i18n = i18n);
}).call(this);
// end of code from http://i18njs.com/js/i18n.js
const ShowPopup = (m, t = "info") => {
    window.popup(m, t);
    [["info", console.log], ["warning", console.warn], ["danger", console.error]].find(g => g[0] === t)[1](m);
}
const svg_osu_miss = URL.createObjectURL(new Blob(
[`<svg viewBox="0 0 128 128" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" >
    <filter id="blur">
        <feFlood flood-color="red" flood-opacity="0.5" in="SourceGraphic" />
        <feComposite operator="in" in2="SourceGraphic" />
        <feGaussianBlur stdDeviation="6" />
        <feComponentTransfer result="glow1"> <feFuncA type="linear" slope="10" intercept="0" /> </feComponentTransfer>
        <feGaussianBlur in="glow1" stdDeviation="1" result="glow2" />
        <feMerge> <feMergeNode in="SourceGraphic" /> <feMergeNode in="glow2" /> </feMerge>
    </filter>
    <filter id="blur2"> <feGaussianBlur stdDeviation="0.2"/> </filter>
    <path id="cross" d="M 26 16 l -10 10 l 38 38 l -38 38 l 10 10 l 38 -38 l 38 38 l 10 -10 l -38 -38 l 38 -38 l -10 -10 l -38 38 Z" />
    <use href="#cross" stroke="red" stroke-width="2" fill="transparent" filter="url(#blur)"/>
    <use href="#cross" fill="white" stroke="transparent" filter="url(#blur2)"/>
</svg>`], {type: "image/svg+xml"}));
const svg_green_tick = URL.createObjectURL(new Blob([
`<svg viewBox="0 0 18 16" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" >
    <polyline points="2,8 7,14 16,2" stroke="#62ee56" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`], {type: "image/svg+xml"}));
const inj_style =
`#osu-db-input{
    display: none;
}
.osu-db-button{
    align-items: center;
    padding: 10px;
}
.osu-db-button:hover{
    cursor: pointer;
}
.beatmapset-panel[owned-beatmapset] .beatmapset-panel__menu-container{
    background-color: #87dda8;
}
.beatmapset-panel[owned-beatmapset] .beatmapset-panel__menu .fa-file-download, .beatmapset-panel[owned-beatmapset] .beatmapset-panel__menu .fa-heart{
    color: #5c9170;
}
.owned-beatmap-link{
    color: #87dda8;
}
.play-detail__accuracy{
    margin: 0px 12px;
}
.play-detail__accuracy.ppAcc{
    color: #8ef9f1;
    padding: 0;
}
.play-detail__weighted-pp{
    margin: 0px;
}
.play-detail__pp{
    flex-direction: column;
}
.lost-pp{
    font-size: 10px;
    position: relative;
    right: 7px;
    font-weight: 600;
}
.score-detail{
    display: inline-block;
}
.score-detail-data-text{
    margin-left: 5px;
    margin-right: 10px;
    width: auto;
    display: inline-block;
}
@keyframes rainbow{
    0%{
        color: #be19ff;
    }
    25%{
        color: #0075ff;
    }
    50%{
        color: #4ddf86;
    }
    75%{
        color: #e9ea00;
    }
    100%{
        color: #ff7800;
    }
}
.play-detail__accuracy-and-weighted-pp{
    display: flex;
    flex-direction: row;
}
.play-detail__before{
    flex-grow: 1;
}
.mania-max{
    animation: 0.16s infinite alternate rainbow;
}
.mania-300{
    color: #fbff00;
}
.osu-100, .fruits-100, .taiko-150{
    color: #67ff5b;
}
.mania-200{
    color: #6cd800;
}
.osu-300, .fruits-300, .taiko-300{
    color: #7dfbff;
}
.mania-100{
    color: #257aea;
}
.mania-50{
    color: #d2d2d2;
}
.osu-50, .fruits-50-miss{
    color: #ffbf00;
}
.mania-miss, .taiko-miss, .fruits-miss{
    color: #cc2626;
}
.mania-max, .mania-300, .mania-200, .mania-100, .mania-50, .mania-miss, .osu-300, .osu-100, .osu-50, .osu-miss{
    font-weight: 600;
}
.score-detail-data-text{
    font-weight: 500;
}
.osu-miss{
    display: inline-block;
}
.osu-miss > img{
    width: 14px;
    height: 14px;
    bottom: 1px;
    position: relative;
}
.play-detail__Accuracy, .play-detail__Accuracy2, .combo, .max-combo, .play-detail__combo{
    display: inline-block;
    width: auto;
}
.play-detail__Accuracy{
    text-align: left;
    color: #fc2;
}
.play-detail__Accuracy2{
    text-align: left;
    color: rgb(142, 249, 241);
}
.play-detail__combo, .play-detail__Accuracy2, .play-detail__Accuracy{
    margin-right: 13px;
}
.play-detail__combo{
    text-align: right;
}
.combo, .max-combo{
    margin: 0px 1px;
}
.max-combo, .legacy-perfect-combo{
    color: hsl(var(--hsl-lime-1));
}
div.bar__exp-info{
    position: relative;
    bottom: 100%;
}
.play-detail__group--background, .beatmap-playcount__background{
    position: absolute;
    width: 90%;
    height: 100%;
    left: 0px;
    margin: 0px;
    pointer-events: none;
    z-index: 1;
    border-radius: 10px 0px 0px 10px;
    background-size: cover;
    background-position-y: -100%;
    mask-image: linear-gradient(to right, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0));
    -webkit-mask-image: linear-gradient(to right, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0));
}
@media(max-width: 900px){
    .play-detail__group--background, .beatmap-playcount__background{
        background-position-y: 0%;
        mask-image: linear-gradient(to bottom, #0007, #0004);
        -webkit-mask-image: linear-gradient(to bottom, #0007, #0004);
        width: 100%;
    }
    .lost-pp{
        left: 3px;
    }
    .play-detail__group.play-detail__group--bottom{
        z-index: 1;
    }
    .play-detail__before{
        flex-grow: 0;
    }
}
.play-detail.play-detail--highlightable.play-detail--pin-sortable.js-score-pin-sortable .play-detail__group--background{
    left: 20px;
}
.beatmap-playcount__background{
    width: 100%;
    border-radius: 6px;
    mask-image: linear-gradient(to right, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.3));
    -webkit-mask-image: linear-gradient(to right, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.3));
}
.beatmap-playcount__info, .beatmap-playcount__detail-count, .play-detail__group.play-detail__group--top *{
    z-index: 1;
}
div.play-detail-list time.js-timeago, span.beatmap-playcount__mapper, span.beatmap-playcount__mapper > a{
    color: #ccc;
}
button.show-more-link{
    z-index: 4;
}
a.beatmap-download-link{
    margin: 0px 5px;
    color: hsl(var(--hsl-l1));
}
a.beatmap-download-link:hover, a.beatmap-pack-item-download-link span:hover{
    color: #fff;
}
a.beatmap-pack-item-download-link span{
    color: hsl(var(--hsl-l1));
}
.play-detail.play-detail--highlightable.audio-player{
    max-width: none;
    height: unset;
    padding: unset;
    align-items: unset;
}
.play-detail.play-detail--highlightable.audio-player__button{
    align-items: unset;
    padding: unset;
}
.play-detail.play-detail--highlightable.audio-player__button:hover{
    color: unset;
}
.sort-detail__items{
    display: flex;
    align-items: center;
    flex-wrap: wrap;
}
.sort-detail__item{
    border-radius: 4px;
    margin: 5px;
}
`;
const scriptContent =
String.raw`console.log("page script injected from osu!web enhancement");
if(window.oldXHROpen === undefined){
    window.oldXHROpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function() {
        this.addEventListener("load", function() {
            const url = this.responseURL;
            const trreg = /https:\/\/(?<subdomain>osu|lazer)\.ppy\.sh\/users\/(?<id>[0-9]+)\/extra-pages\/(?<type>top_ranks|historical)\?mode=(?<mode>osu|taiko|fruits|mania)/.exec(url);
            const adreg = /https:\/\/(?<subdomain>osu|lazer)\.ppy\.sh\/users\/(?<id>[0-9]+)\/scores\/(?<type>firsts|best|recent|pinned)\?mode=(?<mode>osu|taiko|fruits|mania)&limit=[0-9]*&offset=[0-9]*/.exec(url);
            let reg = trreg ?? (adreg ?? null);
            if(!reg){
                const bmsreg = /https:\/\/(?:osu|lazer)\.ppy\.sh\/beatmapsets\/search\?/;
                return;
            }
            let info = {
                type: reg.groups.type,
                userId: Number(reg.groups.id),
                mode: reg.groups.mode,
                subdomain: reg.groups.subdomain,
            };
            const responseBody = this.responseText;
            info.data = JSON.parse(responseBody);
            info.id = "osu!web enhancement";
            window.postMessage(info, "*");
        });
        return oldXHROpen.apply(this, arguments);
    };
}`;
const locales = {
    "en": {
        "values": {
            "Owned": "Owned",
            "Download": "Download",
            "pp Accuracy": "pp Accuracy",
            "V1 Accuracy": "V1 Accuracy",
            "V2 Accuracy": "V2 Accuracy",
            "Lazer Mode Accuracy": "Lazer Mode Accuracy",
            "Stable Mode Accuracy": "Stable Mode Accuracy",
            "Combo": "Combo",
            "Combo/Max Combo": "Combo/Max Combo",
            "Import osu!.db": "Import osu!.db",
            "Check for update": "Check for update",
            "Calculate pp Gini index": "Calculate pp Gini index",
            "Go to GreasyFork page": "Go to GreasyFork page",
            "Copy Text Details": "Copy Text Details",
            "Could not find best play data": "Could not find best play data",
            "The latest version is already installed!": "The latest version is already installed!",
            "Script is already busy reading a osu!.db file.": "Script is already busy reading a osu!.db file.",
            "There are still remaining unread bytes, something may be wrong.": "There are still remaining unread bytes, something may be wrong.",
            "Score details copied to clipboard!": "Score details copied to clipboard!",
            "%{pc} of total pp": "%{pc} of total pp",
            "Your pp Gini index of bp%{bp} is %{val}.": "Your pp Gini index of bp%{bp} is %{val}.",
            "Finished reading osu!.db in %{time} ms.": "Finished reading osu!.db in %{time} ms.",
            "MAX: %{MAX} 300: %{MAX}": "MAX: %{MAX} 300: %{MAX}",
            "Unable to copy score detail to clipboard, check console for more info.": "Unable to copy score detail to clipboard, check console for more info.",
            "Show bp analytic": "Show bp analytic",
            "Close bp analytic": "Close bp analytic",
        }
    },
    "zh": {
        "values": {
            "Owned": "已获得",
            "Download": "下载",
            "pp Accuracy": "pp-准确度",
            "V1 Accuracy": "V1-准确度",
            "V2 Accuracy": "V2-准确度",
            "Lazer Accuracy": "Lazer-准确度",
            "Lazer Mode Accuracy": "Lazer准确度",
            "Stable Mode Accuracy": "Stable准确度",
            "Combo": "连击数",
            "Combo/Max Combo": "连击数/最大连击数",
            "Import osu!.db": "读取 osu!.db",
            "Check for update": "检查更新",
            "Calculate pp Gini index": "计算 pp 基尼指数",
            "Go to GreasyFork page": "前往 GreasyFork 页面",
            "Copy Text Details": "复制文本信息",
            "Could not find best play data": "无法获取 BP 数据",
            "The latest version is already installed!": "已安装最新版本！",
            "Script is already busy reading a osu!.db file.": "脚本已经开始读取 osu!.db 文件。",
            "There are still remaining unread bytes, something may be wrong.": "部分数据未能读取，可能发生错误。",
            "Score details copied to clipboard!": "分数信息已复制到剪贴板！",
            "%{pc} of total pp": "占总 pp 的 %{pc}",
            "Your pp Gini index of bp%{bp} is %{val}.": "BP%{bp} 的 pp 基尼指数为 %{val}。",
            "Finished reading osu!.db in %{time} ms.": "osu!.db 读取完毕，用时 %{time}ms。",
            "MAX: %{MAX} 300: %{MAX}": "MAX: %{MAX} 300: %{MAX}",
        }
    },
    "zh-tw": {
        "values": {
            "Owned": "已獲得",
            "Download": "下載",
            "pp Accuracy": "pp-準確度",
            "V1 Accuracy": "V1-準確度",
            "V2 Accuracy": "V2-準確度",
            "Lazer Accuracy": "Lazer-準確度",
            "Combo": "連擊數",
            "Combo/Max Combo": "連擊數/最大連擊數",
            "Import osu!.db": "讀取 osu!.db",
            "Check for update": "檢查更新",
            "Calculate pp Gini index": "計算 pp 基尼指數",
            "Go to GreasyFork page": "前往 GreasyFork 頁面",
            "Copy Text Details": "複製文字訊息",
            "Could not find best play data": "无法獲取 BP 數據",
            "The latest version is already installed!": "已安裝最新版本！",
            "Script is already busy reading a osu!.db file.": "腳本已經開始讀取 osu!.db 文件。",
            "There are still remaining unread bytes, something may be wrong.": "部分數據未能讀取，可能發生錯誤。",
            "Score details copied to clipboard!": "分數訊息已複製到剪貼簿！",
            "%{pc} of total pp": "佔總 pp 的 %{pc}",
            "Your pp Gini index of bp%{bp} is %{val}.": "BP%{bp} 的 pp 基尼指數為 %{val}。",
            "Finished reading osu!.db in %{time} ms.": "osu!.db 讀取完畢，用時 %{time}ms。",
            "MAX: %{MAX} 300: %{MAX}": "MAX: %{MAX} 300: %{MAX}",
        }
    },
    "ja": {
        "values": {
            "Owned": "取得済み",
            "Download": "ダウンロード",
            "pp Accuracy": "pp-精度",
            "V1 Accuracy": "V1-精度",
            "V2 Accuracy": "V2-精度",
            "Lazer Accuracy": "Lazer-精度",
            "Combo": "コンボ数",
            "Combo/Max Combo": "コンボ数/最大コンボ数",
            "Import osu!.db": "osu!.db を読み取る",
            "Check for update": "更新を確認する",
            "Calculate pp Gini index": "pp のジニ指数の計算",
            "Go to GreasyFork page": "GreasyFork のページへ",
            "Copy Text Details": "詳細をテキストにコピー",
            "Could not find best play data": "BP データが見つからない",
            "The latest version is already installed!": "最新版は既にインストールされている！",
            "Script is already busy reading a osu!.db file.": "スクリプトは osu!.db ファイルの読み取りを既に始める。",
            "There are still remaining unread bytes, something may be wrong.": "一部のデータを読み取れません、多分何かの間違いだ。",
            "Score details copied to clipboard!": "スコア詳細をクリップボードにコピー！",
            "%{pc} of total pp": "全 pp の %{pc}",
            "Your pp Gini index of bp%{bp} is %{val}.": "BP%{bp} の pp ジニ指数は %{val} です。",
            "Finished reading osu!.db in %{time} ms.": "osu!.db の読み取りを %{time}ms で完了しました。",
            "MAX: %{MAX} 300: %{MAX}": "MAX: %{MAX} 300: %{MAX}",
        }
    }
};
const scriptId = "osu-web-enhancement-XHR-script";
if(!document.querySelector(`script#${scriptId}`)){
    const script = document.createElement("script");
    script.textContent = scriptContent;
    document.body.appendChild(script);
}
const persistentEventListeners = new Map();
const HTML = (tagname, attrs, ...children) => {
    if(attrs === undefined) return document.createTextNode(tagname);
    const ele = document.createElement(tagname);
    if(attrs) for(const [key, value] of Object.entries(attrs)){
        if(value === null || value === undefined) continue;
        if(key.charAt(0) === "_"){
            const type = key.slice(1);
            ele.addEventListener(type, value);
        }
        else if(key.charAt(0) === "#" && ele.getAttribute("id") !== null){
            const type = key.slice(1);
            persistentEventListeners.set(ele.getAttribute("id"), {type: type, value: value});
            ele.addEventListener(type, value);
        }
        else if(key === "eventListener"){
            for(const listener of value){
                ele.addEventListener(listener.type, listener.listener, listener.options);
            }
        }
        else ele.setAttribute(key, value);
    }
    for(const child of children) if(child) ele.append(child);
    return ele;
};
const html = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html;
    return t.content.firstElementChild;
};
const OsuMod = {
    NoFail:         1 << 0,
    Easy:           1 << 1,
    TouchDevice:    1 << 2,
    NoVideo:        1 << 2,
    Hidden:         1 << 3,
    HardRock:       1 << 4,
    SuddenDeath:    1 << 5,
    DoubleTime:     1 << 6,
    Relax:          1 << 7,
    HalfTime:       1 << 8,
    Nightcore:      1 << 9, // always with DT
    Flashlight:     1 << 10,
    Autoplay:       1 << 11,
    SpunOut:        1 << 12,
    Autopilot:      1 << 13,
    Perfect:        1 << 14,
    Key4:           1 << 15,
    Key5:           1 << 16,
    Key6:           1 << 17,
    Key7:           1 << 18,
    Key8:           1 << 19,
    KeyMod:         1 << 19 | 1 << 18 | 1 << 17 | 1 << 16 | 1 << 15,
    FadeIn:         1 << 20,
    Random:         1 << 21,
    Cinema:         1 << 22,
    TargetPractice: 1 << 23,
    Key9:           1 << 24,
    Coop:           1 << 25,
    Key1:           1 << 26,
    Key3:           1 << 27,
    Key2:           1 << 28,
    ScoreV2:        1 << 29,
    Mirror:         1 << 30,
};
const Byte = (arr, iter) => {
    return arr[iter.nxtpos++];
}
const RankedStatus = (arr, iter) => {
    const r = {value: Byte(arr, iter), description: ""};
    switch(r.value){
        case 1: r.description = "unsubmitted"; break;
        case 2: r.description = "pending/wip/graveyard"; break;
        case 3: r.description = "unused"; break;
        case 4: r.description = "ranked"; break;
        case 5: r.description = "approved"; break;
        case 6: r.description = "qualified"; break;
        case 7: r.description = "loved"; break;
        default: r.description = "unknown"; r.value = 0;
    }
    return r;
};
const OsuMode = (arr, iter) => {
    const r = {value: Byte(arr, iter), description: ""};
    switch(r.value){
        case 1: r.description = "taiko"; break;
        case 2: r.description = "catch"; break;
        case 3: r.description = "mania"; break;
        default: r.value = 0; r.description = "osu";
    }
    return r;
};
const Grade = (arr, iter) => {
    const r = {value: Byte(arr, iter), description: ""};
    switch(r.value){
        case 0: r.description = "SSH"; break;
        case 1: r.description = "SH"; break;
        case 2: r.description = "SS"; break;
        case 3: r.description = "S"; break;
        case 4: r.description = "A"; break;
        case 5: r.description = "B"; break;
        case 6: r.description = "C"; break;
        case 7: r.description = "D"; break;
        default: r.description = "not played";
    }
    return r;
};
const Short = (arr, iter) => (arr[iter.nxtpos++] | arr[iter.nxtpos++] << 8);
const Int = (arr, iter) => { return arr[iter.nxtpos++] | arr[iter.nxtpos++] << 8 | arr[iter.nxtpos++] << 16 | arr[iter.nxtpos++] << 24; };
const Long = (arr, iter) => { const r = new DataView(arr.buffer, iter.nxtpos, 8).getBigUint64(0, true); iter.nxtpos += 8; return r; };
const ULEB128 = (arr, iter) => {
    let value = 0n, shift = 0n, peek = 0n;
    do{
        peek = BigInt(arr[iter.nxtpos++]);
        value |= (peek & 0x7Fn) << shift;
        shift += 7n;
    }while((peek & 0x80n) !== 0n)
    return value;
};
const Single = (arr, iter) => { const r = new DataView(arr.buffer, iter.nxtpos, 4).getFloat32(0, true); iter.nxtpos += 4; return r; };
const Double = (arr, iter) => { const r = new DataView(arr.buffer, iter.nxtpos, 8).getFloat64(0, true); iter.nxtpos += 8; return r; };
const Boolean = (arr, iter) => { return arr[iter.nxtpos++] !== 0x00; };
const OString = (arr, iter) => {
    let value = "";
    switch(arr[iter.nxtpos++]){
        case 0: break;
        case 0x0b: {
            const l = ULEB128(arr, iter);
            const bv = new Uint8Array(arr.buffer, iter.nxtpos, Number(l));
            value = new TextDecoder().decode(bv);
            iter.nxtpos += Number(l);
            break;
        }
        default: console.assert(false, `error occurred while parsing osu string with the first byte.`);
    }
    return value;
};
const IntDouble = (arr, iter) => {
    const r = {int: 0, double: 0};
    const m1 = arr[iter.nxtpos++];
    console.assert(m1 === 0x08, `error occurred while parsing Int-Double pair at ${iter.nxtpos - 1} with value 0x${m1.toString(16)}: should be 0x8.`);
    r.int = Int(arr, iter);
    const m2 = arr[iter.nxtpos++];
    console.assert(m2 === 0x0d, `error occurred while parsing Int-Double pair at ${iter.nxtpos - 1} with value 0x${m1.toString(16)}: should be 0x8.`);
    r.double = Double(arr, iter);
    return r;
};
const IntDoubleArray = (arr, iter) => {
    const r = new Array(Int(arr, iter));
    for(let i = 0; i < r.length; i++) r[i] = IntDouble(arr, iter);
    return r;
};
const TimingPoint = (arr, iter) => {
    return {
        BPM: Double(arr, iter),
        offset: Double(arr, iter),
        notInherited: Boolean(arr, iter),
    };
};
const TimingPointArray = (arr, iter) => {
    const r = new Array(Int(arr, iter));
    for(let i = 0; i < r.length; i++) r[i] = TimingPoint(arr, iter);
    return r;
};
const DateTime = Long;
const Beatmap = (arr, iter) => {
    return {
        bytes: (iter.osuVersion < 20191106) ? Int(arr, iter) : undefined,
        artistName: OString(arr, iter),
        artistNameUnicode: OString(arr, iter),
        songTitle: OString(arr, iter),
        songTitleUnicode: OString(arr, iter),
        creatorName: OString(arr, iter),
        difficultyName: OString(arr, iter),
        audioFilename: OString(arr, iter),
        MD5Hash: OString(arr, iter),
        beatmapFilename: OString(arr, iter),
        rankedStatus: RankedStatus(arr, iter),
        hitcircleCount: Short(arr, iter),
        sliderCount: Short(arr, iter),
        spinnerCount: Short(arr, iter),
        lastModified: Long(arr, iter),
        AR: iter.osuVersion < 20140609 ? Byte(arr, iter) : Single(arr, iter),
        CS: iter.osuVersion < 20140609 ? Byte(arr, iter) : Single(arr, iter),
        HP: iter.osuVersion < 20140609 ? Byte(arr, iter) : Single(arr, iter),
        OD: iter.osuVersion < 20140609 ? Byte(arr, iter) : Single(arr, iter),
        sliderVelocity: Double(arr, iter),
        osuSRInfoArr: (iter.osuVersion >= 20140609) ? IntDoubleArray(arr, iter) : undefined,
        taikoSRInfoArr: (iter.osuVersion >= 20140609) ? IntDoubleArray(arr, iter) : undefined,
        catchSRInfoArr: (iter.osuVersion >= 20140609) ? IntDoubleArray(arr, iter) : undefined,
        maniaSRInfoArr: (iter.osuVersion >= 20140609) ? IntDoubleArray(arr, iter) : undefined,
        drainTime: Int(arr, iter),
        totalTime: Int(arr, iter),
        audioPreviewTime: Int(arr, iter),
        timingPointArr: TimingPointArray(arr, iter),
        difficultyID: Int(arr, iter),
        beatmapID: Int(arr, iter),
        threadID: Int(arr, iter),
        osuGrade: Grade(arr, iter),
        taikoGrade: Grade(arr, iter),
        catchGrade: Grade(arr, iter),
        maniaGrade: Grade(arr, iter),
        offsetLocal: Short(arr, iter),
        stackLeniency: Single(arr, iter),
        mode: OsuMode(arr, iter),
        sourceStr: OString(arr, iter),
        tagStr: OString(arr, iter),
        offsetOnline: Short(arr, iter),
        titleFont: OString(arr, iter),
        unplayed: Boolean(arr, iter),
        lastTimePlayed: Long(arr, iter),
        isOsz2: Boolean(arr, iter),
        folderName: OString(arr, iter),
        lastTimeChecked: Long(arr, iter),
        ignoreBeatmapSound: Boolean(arr, iter),
        ignoreBeatmapSkin: Boolean(arr, iter),
        disableStoryboard: Boolean(arr, iter),
        disableVideo: Boolean(arr, iter),
        visualOverride: Boolean(arr, iter),
        uselessShort: (iter.osuVersion < 20140609) ? Short(arr, iter) : undefined,
        lastModified2: Int(arr, iter),
        scrollSpeedMania: Byte(arr, iter),
    };
};
class _ProgressBar{
    barEle = null;
    Show(){
        if(this.barEle) { this.barEle.style.setProperty("opacity", "1"); return; }
        this.barEle = HTML("div", {class: "owenhancement-progress-bar", style: "position: fixed; left: 0px; top: 0px; width: 0%; height: 3px; background-color: #fc2; opacity: 1; z-index: 999;"});
        document.body.insertAdjacentElement("beforebegin", this.barEle);
    }
    Progress(prog){
        if(this.barEle) this.barEle.style.setProperty("width", `${prog * 100}%`);
        if(prog >= 1) this.Hide();
    }
    Hide(){ this.barEle.style.setProperty("opacity", "0"); }
};
const ProgressBar = new _ProgressBar();
const BeatmapArray = async (arr, iter) => {
    const t = 200;
    const r = new Array(Int(arr, iter));
    let l = performance.now();
    for(let i = 0; i < r.length; i++){
        r[i] = Beatmap(arr, iter);
        if(performance.now() - l > t){
            l = performance.now();
            ProgressBar.Progress((i + 1) / (r.length));
            await new Promise((res, rej) => setTimeout(() => res(), 0));
        }
    }
    return r;
};
const OsuDb = async (arr, iter) => {
    ProgressBar.Show();
    const r = {};
    r.version = Int(arr, iter);
    iter.osuVersion = r.version;
    r.folderCount = Int(arr, iter);
    r.accountUnlocked = Boolean(arr, iter);
    r.timeTillUnlock = DateTime(arr, iter);
    r.playerName = OString(arr, iter);
    r.beatmapArray = await BeatmapArray(arr, iter);
    r.permission = Int(arr, iter);
    ProgressBar.Hide();
    return r;
};
class ScoreDb{
    constructor(arr, iter){

    }
}
const beatmapsets = new Set();
const beatmaps = new Set();
const bmsReg = /https:\/\/(?:osu|lazer)\.ppy\.sh\/beatmapsets\/([0-9]+)/;
const bmsdlReg = /https:\/\/(?:osu|lazer)\.ppy\.sh\/beatmapsets\/([0-9]+)\/download/;
const bmReg = /https:\/\/(?:osu|lazer)\.ppy\.sh\/beatmapsets\/(?:[0-9]+)#(?:mania|osu|fruits|taiko)\/([0-9]+)/;
const BeatmapsetRefresh = () => {
    for(const bm of window.osudb.beatmapArray){
        beatmaps.add(bm.difficultyID);
        beatmapsets.add(bm.beatmapID);
    }
    OnMutation();
};
const NewOsuDb = async (r) => {
    const start = performance.now();
    const result = new Uint8Array(r.result);
    const length = result.length;
    console.log(`start reading osu!.db(${length} Bytes).`);
    const iter = {
        nxtpos: 0,
    };
    window.osudb = await OsuDb(result, iter);
    if(iter.nxtpos !== length) ShowPopup(i18n("There are still remaining unread bytes, something may be wrong."), "danger");
    ShowPopup(i18n("Finished reading osu!.db in %{time} ms.", {time: performance.now() - start}));
};
let ReadOsuDbWorking = false;
const ReadOsuDb = async (file) => {
    if(ReadOsuDbWorking){
        ShowPopup(i18n("Script is already busy reading a osu!.db file."), "warning");
        return;
    }
    ReadOsuDbWorking = true;
    if(file.name !== "osu!.db"){ console.assert( false, "filename should be 'osu!.db'."); return; }
    const r = new FileReader();
    r.onload = async () => {
        await NewOsuDb(r);
        BeatmapsetRefresh();
        ReadOsuDbWorking = false;
    };
    r.onerror = () => console.assert(false, "error occurred while reading file.");
    r.readAsArrayBuffer(file);
};
const SelectOsuDb = (event) => {
    const t = event.target;
    const l = t.files;
    console.assert(l && l.length === 1, "No file or multiple files are selected.");
    ReadOsuDb(l[0]);
};
let osuAccessToken = "";
let osuAccessTokenExpireTime = 0;
let lock = false;
let queue = [];
const GetToken = async () => {
    if(!lock){
        lock = true;
        const clientID = GM_getValue("oep_client_id", "");
        const clientSecret = GM_getValue("oep_client_secret", "");
        if(!clientID || !clientSecret){
            lock = false;
            console.assert(false, "osu! OAuth client_id/client_secret are not configured.");
            return "";
        }
        if(osuAccessToken === "" || new Date().getTime() > osuAccessTokenExpireTime){
            const response = await fetch("https://osu.ppy.sh/oauth/token", {
                method: "POST",
                body: new URLSearchParams([
                    ["client_id", clientID],
                    ["client_secret", clientSecret],
                    ["grant_type", "client_credentials"],
                    ["scope", "public"],
                ]),
            });
            const responseData = await response.json();
            osuAccessToken = responseData.access_token;
            osuAccessTokenExpireTime = new Date().getTime() + responseData.expires_in * 1000;
        }
        lock = false;
        let resolve;
        while(resolve = queue.shift()) resolve();
    }
    else{
        const {promise, resolve, reject} = Promise.withResolvers();
        queue.push(resolve);
        await promise;
    }
    return osuAccessToken;
}
const CheckForUpdate = () => {
    const verReg = /<dd class="script-show-version"><span>([0-9\.]+)<\/span><\/dd>/;
    fetch("https://greasyfork.org/en/scripts/475417-osu-web-enhancement", {
        credentials: "omit"
    }).then(response => response.text()).then((html) => {
        const ver = verReg.exec(html);
        if(ver){
            const result = (() => {
                const verList = ver[1].split(".");
                const thisVer = GM_info.script.version;
                console.log(`latest version is: ${ver[1]}, current version is: ${thisVer}`);
                const thisVerList = thisVer.split(".");
                for(let i = 0; i < verList.length; i++){
                    if(Number(verList[i]) > Number(thisVerList[i] ?? 0)) return true;
                    else if(Number(verList[i]) < Number(thisVerList[i] ?? 0)) return false;
                }
                return false;
            })();
            if(result){
                const a = HTML("a", {href: "https://greasyfork.org/scripts/475417-osu-web-enhancement/code/osu!web%20enhancement.user.js", download: "", style: "display:none;"});
                a.click();
            }
            else{
                ShowPopup(i18n("The latest version is already installed!"))
            }
        }
    });
};
const AddMenu = () => {
    const menuId = "osu-web-enhancement-toolbar";
    if(!window.menuEventListener){
        window.addEventListener("click", (ev) => {
            const fid = ev.target?.dataset?.functionId;
            if(fid) switch(fid){
                case "import-osu-db-button": document.getElementById("osu-db-input")?.click(); break;
                case "check-for-update-button": CheckForUpdate(); break;
                case "pp-gini-index-calculator": PPGiniIndex(); break;
            }
        });
        window.menuEventListener = true;
    }
    if(document.getElementById(menuId)) return;
    const anc = document.querySelector("div.nav2__col.nav2__col--menu.js-react--quick-search-button");
    const i = HTML("input", {type: "file", id: "osu-db-input", accept: ".db", eventListener: [{
        type: "change",
        listener: SelectOsuDb,
        options: false,
    }]});
    const menuClass = "simple-menu simple-menu--nav2 simple-menu--nav2-left-aligned simple-menu--nav2-transparent js-menu";
    const menuItemClass = "simple-menu__item u-section-community--before-bg-normal";
    const menuTgtId = "osu-web-enhancement";
    anc.insertAdjacentElement("beforebegin",
        HTML("div", {class: "nav2__col nav2__col--menu", id: menuId},
            HTML("div", {class: "nav2__menu-link-main js-menu", "data-menu-target": `nav2-menu-popup-${menuTgtId}`, "data-menu-show-delay":"0", style:"flex-direction: column; cursor: default;"},
                HTML("span", {style: "flex-grow: 1;"}),
                HTML("span", {style: "font-size: 10px;"}, HTML("osu!web")),
                HTML("span", {style: "font-size: 10px;"}, HTML("enhancement")),
                HTML("span", {style: "flex-grow: 1;"}),
            ),
            HTML("div", {class: "nav2__menu-popup"},
                HTML("div", {class: `${menuClass}`, "data-menu-id": `nav2-menu-popup-${menuTgtId}`, "data-visibility": "hidden"},
                    HTML("div", {class: `${menuItemClass}`, style: "cursor: pointer;", "data-function-id": "import-osu-db-button", }, HTML(i18n("Import osu!.db"))),
                    HTML("div", {class: `${menuItemClass}`, style: "cursor: pointer;", "data-function-id": "check-for-update-button"}, HTML(i18n("Check for update"))),
                    HTML("div", {class: `${menuItemClass}`, style: "cursor: pointer;", "data-function-id": "pp-gini-index-calculator"}, HTML(i18n("Calculate pp Gini index"))),
                    HTML("a", {class: `${menuItemClass}`, style: "cursor: pointer;", href: "https://greasyfork.org/en/scripts/475417-osu-web-enhancement", target: "_blank"}, HTML(i18n("Go to GreasyFork page")))
                ),
            )
        )
    );
    const mobMenuItmCls = "navbar-mobile-item__submenu-item js-click-menu--close";
    const mob = document.querySelector(`div.mobile-menu__item.js-click-menu[data-click-menu-id="mobile-nav"]`);
    mob.insertAdjacentElement("beforeend",
        HTML("div", {class: "navbar-mobile-item"},
            HTML("div", {class: "navbar-mobile-item__main js-click-menu", "data-click-menu-target": `nav-mobile-${menuTgtId}`, style: "cursor: pointer;"},
                HTML("span", {class: "navbar-mobile-item__icon navbar-mobile-item__icon--closed"},
                    HTML("i", {class: "fas fa-chevron-right"})
                ),
                HTML("span", {class: "navbar-mobile-item__icon navbar-mobile-item__icon--opened"},
                    HTML("i", {class: "fas fa-chevron-down"})
                ),
                HTML("osu!web enhancement"),
            ),
            HTML("ul", {class: "navbar-mobile-item__submenu js-click-menu", "data-click-menu-id": `nav-mobile-${menuTgtId}`, "data-visibility": "hidden"},
                HTML("li", {}, HTML("div", {class: mobMenuItmCls, style: "cursor: pointer;", "data-function-id": "import-osu-db-button",}, HTML(i18n("Import osu!.db")))),
                HTML("li", {}, HTML("div", {class: mobMenuItmCls, style: "cursor: pointer;", "data-function-id": "check-for-update-button"}, HTML(i18n("Check for update")))),
                HTML("li", {}, HTML("div", {class: mobMenuItmCls, style: "cursor: pointer;", "data-function-id": "pp-gini-index-calculator"}, HTML(i18n("Calculate pp Gini index")))),
                HTML("a", {class: `${mobMenuItmCls}`, style: "cursor: pointer;", href: "https://greasyfork.org/en/scripts/475417-osu-web-enhancement", target: "_blank"}, HTML(i18n("Go to GreasyFork page")))
            )
        )
    );
    document.body.appendChild(i);
};
const FilterBeatmapSet = () => {
    document.querySelectorAll(".beatmapset-panel").forEach((item) => {
        const bmsID = Number(bmsReg.exec(item.innerHTML)?.[1]);
        if(bmsID && beatmapsets.has(bmsID)){
            item.setAttribute("owned-beatmapset", "");
        }
    });
    document.querySelectorAll("div.bbcode a, a.osu-md__link").forEach(item => {
        if(item.classList.contains("owned-beatmap-link") || item.classList.contains("beatmap-download-link")) return;
        const e = bmsReg.exec(item.href);
        if(e && beatmapsets.has(Number(e[1]))){
            item.classList.add("owned-beatmap-link");
            if(item.nextElementSibling?.classList?.contains("beatmap-download-link")) item.nextElementSibling.remove();
            const box = item.getBoundingClientRect();
            const size = Math.round(box.height / 16 * 14);
            const vert = Math.round(size * 4 / 14) / 2;
            item.after(HTML("img", {src: svg_green_tick, title: i18n("Owned"), alt: "owned beatmap", style: `margin: 0px 5px; width: ${size}px; height: ${size}px; vertical-align: -${vert}px;`}));
        }else if(e && !item.nextElementSibling?.classList?.contains("beatmap-download-link")){
            item.after(
                HTML("a", {class: "beatmap-download-link", href: `https://osu.ppy.sh/beatmapsets/${e[1]}/download`, download: ""},
                    HTML("span", {class: "fas fa-file-download", title: i18n("Download")})
                )
            );
        }
    });
    document.querySelectorAll("li.beatmap-pack-items__set").forEach(item => {
        if(item.classList.contains("owned-beatmap-pack-item")) return;
        const a = item.querySelector("a.beatmap-pack-items__link");
        const e = bmsReg.exec(a.href);
        if(e && beatmapsets.has(Number(e[1]))){
            item.classList.add("owned-beatmap-pack-item");
            const span = item.querySelector("span.fal");
            span.setAttribute("title", i18n("Owned"));
            span.dataset.origTitle = "owned";
            span.setAttribute("class", "");
            span.append(HTML("img", {src: svg_green_tick, alt: "owned beatmap", style: `width: 16px; height: 16px; vertical-align: -2px;`}));
            const parent = item.querySelector(".beatmap-pack-item-download-link");
            if(parent){
                console.assert(parent.parentElement === item, "unexpected error occurred!");
                item.insertBefore(span, parent);
                parent.remove();
            }
        }else if(e){
            const icon = item.querySelector(".beatmap-pack-items__icon");
            icon.setAttribute("title", i18n("Download"));
            icon.setAttribute("class", "fas fa-file-download beatmap-pack-items__icon");
            if(icon.parentElement === item){
                const dl = HTML("a", {class: "beatmap-pack-item-download-link", href: `https://osu.ppy.sh/beatmapsets/${e[1]}/download`, download: ""});
                item.insertBefore(dl, icon);
                dl.append(icon);
            }
        }
    })
};
const AdjustStyle = (modestr, sectionName) => {
    const styleSheetId = `userscript-generated-stylesheet-${sectionName}`;
    let e = document.getElementById(styleSheetId);
    if(!e){
        e = document.createElement("style");
        e.id = styleSheetId;
        document.head.appendChild(e);
    }
    const s = e.sheet;
    while(s.cssRules.length) s.deleteRule(0);
    const sectionSelector = `div.js-sortable--page[data-page-id="${sectionName}"]`;
    let ll = [];
    switch(modestr){
        case "mania": ll = [".mania-300", ".mania-200", ".mania-100", ".mania-50", ".mania-miss"]; break;
        case "fruits": ll = [".fruits-300", ".fruits-100", ".fruits-50-miss", ".fruits-miss"]; break;
        case "taiko": ll = [".taiko-300", ".taiko-150", ".taiko-miss"]; break;
        case "osu": ll = [".osu-300", ".osu-100", ".osu-50", ".osu-miss"]; break;
    }
    class FasterCalc{
        _map = new Map();
        Calculate = (ele) => {
            const t = ele.textContent;
            let w = 0, changed = false;
            for(const c of t){
                let wc = this._map.get(c);
                if(!wc){
                    if(!changed) changed = ele.cloneNode(true);
                    ele.textContent = c;
                    wc = ele.clientWidth;
                    this._map.set(c, wc);
                }
                w += wc;
            }
            if(changed){
                ele.insertAdjacentElement("afterend", changed);
                ele.remove();
            }
            return w;
        };
    };
    let fc = new FasterCalc();
    ll.forEach((str) =>
        s.insertRule(
            `${sectionSelector} ${str} + .score-detail-data-text {
                width: ${[...document.querySelectorAll(`${sectionSelector} ${str} + .score-detail-data-text`)].reduce((max, ele) => { const w = fc.Calculate(ele); return w > max ? w : max }, 0) + 2}px;
            }` ,0
        )
    );
    fc = new FasterCalc();
    [".play-detail__combo", ".play-detail__Accuracy", ".play-detail__Accuracy2"].forEach((str) =>
        s.insertRule(
            `${sectionSelector} ${str}{
                min-width: ${Math.ceil([...document.querySelectorAll(`${sectionSelector} ${str}`)].reduce((max, ele) => {const w = fc.Calculate(ele); return w > max ? w : max;}, 0)) + 1}px;
            }`
            ,0
        )
    );
    [".play-detail__pp"].forEach((str) =>
        s.insertRule(
            `${sectionSelector} ${str}{
                min-width: ${Math.ceil([...document.querySelectorAll(`${sectionSelector} ${str}`)].reduce((max, ele) => {const w = ele.clientWidth; return w > max ? w : max;}, 0)) + 1}px;
            }`
            ,0
        )
    );
};
const PPGiniIndex = () => {
    const vals = [...document.querySelectorAll(`div.js-sortable--page[data-page-id="top_ranks"] div.play-detail-list:nth-child(4) div.play-detail.play-detail--highlightable`)]
    .map((ele) => {const ppele = ele.querySelector("div.play-detail__pp span"); return Number((ppele.title ? ppele.title : ppele.dataset.origTitle).replaceAll(",", ""))})
    .sort((a, b) => b - a);
    if(vals.length === 0) {
        ShowPopup(i18n("Could not find best play data"), "danger");
        return;
    }
    const min = vals[vals.length - 1];
    let _ = 0; for(let i = vals.length - 1; i >= 0; i--) {
        _ += vals[i] - min;
        vals[i] = _;
    }
    const SB = vals.reduce((sum, val) => sum + val, -(vals[0] / 2));
    const SAB = vals[0] / 2 * vals.length;
    ShowPopup(i18n("Your pp Gini index of bp%{bp} is %{val}.", {bp: vals.length, val: (1 - SB/SAB).toPrecision(6)}));
}
const IsLazer = () => {
    if(document.querySelector("button[data-url=\"https://osu.ppy.sh/home/account/options?user_profile_customization%5Blegacy_score_only%5D=1\"] span.fas")) return true;
    else return false;
}
const TopRanksWorker = (userId, modestr, addedNodes = [document.body]) => {
    const isLazer = IsLazer();
    const subdomain = "osu"; // This line was const subdomain = isLazer ? "lazer": "osu"; now lazer.ppy.sh is no longer in use.
    const sectionNames = new Set();
    const GetSection = (ele) => {
        let count = 0;
        while(ele){
            if(ele.tagName === "DIV" && ele.className === "js-sortable--page") return ele.dataset.pageId;
            ele = ele.parentElement;
            count++;
            if(count > 50) console.log(ele);
        }
    };
    addedNodes.forEach((eles) => {
        if(eles instanceof Element) eles.querySelectorAll(":scope div.play-detail.play-detail--highlightable").forEach((ele) => {
            if(ele.getAttribute("improved") !== null) return;
            let a = ele.querySelector(":scope time.js-timeago");
            // add support for osu!plus by @RealStr1ke
            if(a === null) a = ele.querySelector(":scope time.timeago")
            const t = a.getAttribute("datetime");
            const data = messageCache.get(`${userId},${modestr},${subdomain},${t}`);
            if(data){
                sectionNames.add(GetSection(ele));
                ListItemWorker(ele, data, isLazer);
            }
        });
    });
    sectionNames.forEach(sectionName => AdjustStyle(modestr, sectionName));
};
const DiffToColour = (diff, stops = [0, 0.1, 1.25, 2, 2.5, 3.3, 4.2, 4.9, 5.8, 6.7, 7.7, 9], vals = ['#AAAAAA', '#4290FB', '#4FC0FF', '#4FFFD5', '#7CFF4F', '#F6F05C', '#FF8068', '#FF4E6F', '#C645B8', '#6563DE', '#18158E', '#000000']) => {
    const len = stops.length;
    diff = Math.min(Math.max(diff, stops[0]), stops[len - 1]);
    let r = stops.findIndex(stop => stop > diff);
    if(r === -1) r = len - 1;
    const d = stops[r] - stops[r - 1];
    return `#${[[1, 3], [3, 5], [5, 7]]
        .map(_ => [Number.parseInt(vals[r].slice(..._), 16), Number.parseInt(vals[r-1].slice(..._), 16)])
        .map(_ => Math.round((_[0] ** 2.2 * (diff - stops[r-1]) / d + _[1] ** 2.2 * (stops[r] - diff) / d) ** (1 / 2.2)).toString(16).padStart(2, "0"))
        .join("")
    }`;
};
const CustomToPrecision = (number, precision) => {
    return number >= 1 ? number.toPrecision(precision) : (number < (10 ** (-precision + 1) / 2) ? 0 : number.toFixed(precision - 1));
} 
const ListItemWorker = (ele, data, isLazer) => {
    console.log(isLazer);
    if(ele.getAttribute("improved") !== null) return;
    ele.setAttribute("improved", "");
    ele.setAttribute("data-replay-id", data.id);
    if(data.pp){
        data.pp = Number(data.pp);
        const pptext = ele.querySelector(".play-detail__pp > span").childNodes[0];
        pptext.nodeValue = CustomToPrecision(data.pp, 5);
        if(data.weight) pptext.title = i18n("%{pc} of total pp", {pc: CustomToPrecision(data.weight.pp, 5)});
    }
    const left = ele.querySelector("div.play-detail__group.play-detail__group--top");
    const leftc = HTML("div", {class: "play-detail__group--background", style: `background-image: url(https://assets.ppy.sh/beatmaps/${data.beatmap.beatmapset_id}/covers/card@2x.jpg);`});
    left.insertAdjacentElement("beforebegin", leftc);
    const detail = ele.querySelector("div.play-detail__score-detail-top-right");
    const du = detail.children[0];
    if(!detail.children[1]) detail.append(HTML("div", {classList: "play-detail__pp-weight"}));
    const db = detail.children[1];
    data.statistics.perfect ??= 0, data.statistics.great ??= 0, data.statistics.good ??= 0, data.statistics.ok ??= 0, data.statistics.meh ??= 0, data.statistics.miss ??= 0;
    const bmName = ele.querySelector("span.play-detail__beatmap");
    GetToken().then(async (token) => {
        const body = {
            mods: data.mods.map((modObj) => modObj.acronym),
            ruleset_id: data.ruleset_id,
        };
        const response = await fetch(`https://osu.ppy.sh/api/v2/beatmaps/${data.beatmap.id}/attributes`,{
            method: "POST",
            body: JSON.stringify(body),
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/json",
                "Content-Type": "application/json",
            }
        });
        const attributes = (await response.json()).attributes;
        console.log(body, attributes);
        const starRatingElement = HTML("div", {class: `difficulty-badge ${attributes.star_rating >= 6.5 ? "difficulty-badge--expert-plus" : ""}`, style: `--bg: ${DiffToColour(attributes.star_rating)}`},
            HTML("span", {class: "difficulty-badge__icon"}, HTML("span", {class: "fas fa-star"})),
            HTML("span", {class: "difficulty-badge__rating"}, HTML(`${attributes.star_rating.toFixed(2)}`))
        );
        bmName.parentElement.insertBefore(starRatingElement, bmName);
    })
    /*
    const ic = ele;
    ic.classList.add("audio-player", "js-audio--player");
    ic.setAttribute("data-audio-url", `https://b.ppy.sh/preview/${data.beatmap.beatmapset_id}.mp3`)
    ic.setAttribute("data-audio-state", "paused");
    const gr = ele;
    gr.classList.add("audio-player__button", "audio-player__button--play", "js-audio--play");
    */
    const bma = ele.querySelector("a.play-detail__title");
    // const modeName = ["STD", "TAIKO", "CTB", "MANIA"];
    bma.onclick = (e) => {e.stopPropagation();};
    switch(data.ruleset_id){
        case 0:{
            du.replaceChildren(
                HTML("span", {class: "play-detail__before"}),
                HTML("span", {class: "play-detail__Accuracy", title: i18n(`${isLazer ? "Lazer Mode" : "Stable Mode"} Accuracy`)}, HTML(`${(data.accuracy * 100).toFixed(2)}%`)),
                HTML("span", {class: "play-detail__combo", title: i18n(`Combo${isLazer ? "/Max Combo" : ""}`)},
                    HTML("span", {class: `combo ${isLazer ?(data.max_combo === (data.maximum_statistics.great ?? 0) + (data.maximum_statistics.legacy_combo_increase ?? 0) ? "legacy-perfect-combo" : ""):(data.legacy_perfect ? "legacy-perfect-combo" : "")}`}, HTML(`${data.max_combo}`)),
                    isLazer ? HTML("/") : null,
                    isLazer ? HTML("span", {class: "max-combo"}, HTML(`${(data.maximum_statistics.great ?? 0) + (data.maximum_statistics.legacy_combo_increase ?? 0)}`)) : null,
                    HTML("x"),
                ),
            );
            const m_300 = HTML("span", {class: "score-detail score-detail-osu-300"},
                HTML("span", {class: "osu-300"},
                    HTML("300")
                ),
                HTML("span", {class: "score-detail-data-text"},
                    HTML(`${data.statistics.great + data.statistics.perfect}`)
                )
            );
            const s100 = HTML("span", {class: "score-detail score-detail-osu-100"},
                HTML("span", {class: "osu-100"},
                    HTML("100")
                ),
                HTML("span", {class: "score-detail-data-text"},
                    HTML(`${data.statistics.ok + data.statistics.good}`)
                )
            );
            const s50 = HTML("span", {class: "score-detail score-detail-osu-50"},
                HTML("span", {class: "osu-50"},
                    HTML("50")
                ),
                HTML("span", {class: "score-detail-data-text"},
                    HTML(`${data.statistics.meh}`)
                )
            );
            const s0 = HTML("span", {class: "score-detail score-detail-osu-miss"},
                HTML("span", {class: "osu-miss"},
                    HTML("img", {src: svg_osu_miss, alt: "miss"})
                ),
                HTML("span", {class: "score-detail-data-text"},
                    HTML(`${data.statistics.miss}`)
                )
            );
            db.replaceChildren(m_300, s100, s50, s0);
            break;
        }
        case 1:{
            const cur = [data.statistics.great ?? 0, data.statistics.ok ?? 0, data.statistics.miss ?? 0];
            const mx = cur[0] + cur[1] + cur[2];
            du.replaceChildren(
                HTML("span", {class: "play-detail__before"}),
                HTML("span", {class: "play-detail__Accuracy", title: i18n(`${isLazer ? "Lazer Mode" : "Stable Mode"} Accuracy`)}, HTML(`${(data.accuracy * 100).toFixed(2)}%`)),
                HTML("span", {class: "play-detail__combo", title: i18n(`Combo/Max Combo`)},
                    HTML("span", {class: `combo ${(data.max_combo === mx ? "legacy-perfect-combo" : "")}`}, HTML(`${data.max_combo}`)),
                    HTML("/"),
                    HTML("span", {class: "max-combo"}, HTML(`${mx}`)),
                    HTML("x"),
                ),
            );
            db.replaceChildren(
                HTML("span", {class: "score-detail score-detail-taiko-300"},
                        HTML("span", {class: "taiko-300"}, HTML("300")),
                        HTML("span", {class: "score-detail-data-text"}, HTML(data.statistics.great ?? 0))
                ),
                HTML("span", {class: "score-detail score-detail-taiko-150"},
                        HTML("span", {class: "taiko-150"}, HTML("150")),
                        HTML("span", {class: "score-detail-data-text"}, HTML(data.statistics.ok ?? 0))
                ),
                HTML("span", {class: "score-detail score-detail-fruits-combo"},
                    HTML("span", {class: "taiko-miss"}, HTML("miss")),
                    HTML("span", {class: "score-detail-data-text"}, HTML(data.statistics.miss ?? 0))
                ),
            );
            break;
        }
        case 2:{
            if (isLazer) {
                const cur = [data.statistics.great ?? 0, data.statistics.large_tick_hit ?? 0, data.statistics.small_tick_hit ?? 0];
                const mx = [data.maximum_statistics.great ?? 0, data.maximum_statistics.large_tick_hit ?? 0, data.maximum_statistics.small_tick_hit ?? 0];
                du.replaceChildren(
                    HTML("span", {class: "play-detail__before"}),
                    HTML("span", {class: "play-detail__Accuracy", title: i18n(`Lazer Mode Accuracy`)}, HTML(`${(data.accuracy * 100).toFixed(2)}%`)),
                    HTML("span", {class: "play-detail__combo", title: i18n(`Combo/Max Combo`)},
                        HTML("span", {class: `combo ${(data.max_combo === mx[0] + mx[1] ? "legacy-perfect-combo" : "")}`}, HTML(`${data.max_combo}`)),
                        HTML("/"),
                        HTML("span", {class: "max-combo"}, HTML(`${mx[0] + mx[1]}`)),
                        HTML("x"),
                    ),
                );
                db.replaceChildren(
                    HTML("span", {class: "score-detail score-detail-fruits-300"},
                        HTML("span", {class: "fruits-300"}, HTML("fruits")),
                        HTML("span", {class: "score-detail-data-text"}, HTML(cur[0] + "/" + mx[0]))
                    ),
                    HTML("span", {class: "score-detail score-detail-fruits-100"},
                        HTML("span", {class: "fruits-100"}, HTML("ticks")),
                        HTML("span", {class: "score-detail-data-text"}, HTML(cur[1] + "/" + mx[1]))
                    ),
                    HTML("span", {class: "score-detail score-detail-fruits-50-miss"},
                        HTML("span", {class: "fruits-50-miss"}, HTML("drops")),
                        HTML("span", {class: "score-detail-data-text"}, HTML(cur[2] + "/" + mx[2]))
                    )
                );
            } else {
                du.replaceChildren(
                    HTML("span", {class: "play-detail__before"}),
                    HTML("span", {class: "play-detail__Accuracy", title: i18n(`Stable Mode Accuracy`)}, HTML(`${(data.accuracy * 100).toFixed(2)}%`)),
                    HTML("span", {class: "play-detail__combo", title: i18n(`Combo`)},
                        HTML("span", {class: ""}, HTML(`${data.max_combo}`)),
                        HTML("x")
                    ),
                );
                db.replaceChildren(
                    HTML("span", {class: "score-detail score-detail-fruits-300"},
                        HTML("span", {class: "fruits-300"}, HTML("FRUIT")),
                        HTML("span", {class: "score-detail-data-text"}, HTML(data.statistics.great ?? 0))
                    ),
                    HTML("span", {class: "score-detail score-detail-fruits-100"},
                        HTML("span", {class: "fruits-100"}, HTML("tick")),
                        HTML("span", {class: "score-detail-data-text"}, HTML(data.statistics.large_tick_hit ?? 0))
                    ),
                    HTML("span", {class: "score-detail score-detail-fruits-50-miss"},
                        HTML("span", {class: "fruits-50-miss"}, HTML("miss")),
                        HTML("span", {class: "score-detail-data-text"}, HTML(data.statistics.small_tick_miss ?? 0))
                    ),
                    HTML("span", {class: "score-detail score-detail-fruits-miss"},
                        HTML("span", {class: "fruits-miss"}, HTML("MISS")),
                        HTML("span", {class: "score-detail-data-text"}, HTML(data.statistics.miss ?? 0))
                    )
                );
            }
            break;
        }
        case 3:{
            const ppAcc = (320*data.statistics.perfect+300*data.statistics.great+200*data.statistics.good+100*data.statistics.ok+50*data.statistics.meh)/(320*(data.statistics.perfect+data.statistics.great+data.statistics.good+data.statistics.ok+data.statistics.meh+data.statistics.miss));
            const v2Acc = (305*data.statistics.perfect+300*data.statistics.great+200*data.statistics.good+100*data.statistics.ok+50*data.statistics.meh)/(305*(data.statistics.perfect+data.statistics.great+data.statistics.good+data.statistics.ok+data.statistics.meh+data.statistics.miss));
            const v1Acc = (300*data.statistics.perfect+300*data.statistics.great+200*data.statistics.good+100*data.statistics.ok+50*data.statistics.meh)/(300*(data.statistics.perfect+data.statistics.great+data.statistics.good+data.statistics.ok+data.statistics.meh+data.statistics.miss));
            const MCombo = (data.maximum_statistics.perfect ?? 0) + (data.maximum_statistics.legacy_combo_increase ?? 0);
            const isMCombo = isLazer ? data.max_combo >= MCombo : data.legacy_perfect;
            du.replaceChildren(
                HTML("span", {class: "play-detail__before"}),
                HTML("span", {class: "play-detail__Accuracy2", title: i18n(`pp Accuracy`)}, HTML(`${(ppAcc * 100).toFixed(2)}%`)),
                isLazer ? 
                HTML("span", {class: "play-detail__Accuracy", title: i18n(`Lazer Mode Accuracy`)}, HTML(`${(((data.rank === "D" && data.accuracy === 0) ? v2Acc : data.accuracy) * 100).toFixed(2)}%`)):
                HTML("span", {class: "play-detail__Accuracy", title: i18n(`Stable Mode Accuracy`)}, HTML(`${(((data.rank === "D" && data.accuracy === 0) ? v1Acc : v1Acc) * 100).toFixed(2)}%`)),
                HTML("span", {class: "play-detail__combo", title: i18n(`Combo${isLazer ? "/Max Combo" : ""}`)},
                    HTML("span", {class: `combo ${isMCombo ? "legacy-perfect-combo" : ""}`}, HTML(`${data.max_combo}`)),
                    isLazer ? HTML("/") : null,
                    isLazer ? HTML("span", {class: "max-combo"}, HTML(MCombo)) : null,
                    HTML("x"),
                ),
            );
            if(data.pp){
                const lostpp = CustomToPrecision(data.pp * (0.2 / (Math.min(Math.max(ppAcc, 0.8), 1) - 0.8) - 1), 4);
                ele.querySelector(".play-detail__pp").appendChild(HTML("span", {class: "lost-pp"}, HTML(lostpp === 0 ? "MAX" : `-${lostpp}`)));
            }
            const M_300 = Number(data.statistics.perfect) / Math.max(Number(data.statistics.great), 1);
            db.replaceChildren(
                HTML("span", {class: "score-detail score-detail-mania-max-300", title: i18n("MAX: %{perfect}, 300: %{great}", data.statistics)},
                    HTML("span", {class: "mania-max"}, HTML("M")),
                    HTML("/"),
                    HTML("span", {class: "mania-300"}, HTML("300")),
                    HTML("span", {class: "score-detail-data-text"}, HTML(`${M_300 >= 1000 ? Math.round(M_300) : (M_300 < 1 ? M_300.toFixed(2): M_300.toPrecision(3))}`))
                ),
                HTML("span", {class: "score-detail score-detail-mania-max-200"},
                    HTML("span", {class: "mania-200"}, HTML("200")),
                    HTML("span", {class: "score-detail-data-text"}, HTML(data.statistics.good))
                ),
                HTML("span", {class: "score-detail score-detail-mania-max-100"},
                    HTML("span", {class: "mania-100"}, HTML("100")),
                    HTML("span", {class: "score-detail-data-text"}, HTML(data.statistics.ok))
                ),
                HTML("span", {class: "score-detail score-detail-mania-max-50"},
                    HTML("span", {class: "mania-50"}, HTML("50")),
                    HTML("span", {class: "score-detail-data-text"}, HTML(data.statistics.meh))
                ),
                HTML("span", {class: "score-detail score-detail-mania-max-0"},
                    HTML("span", {class: "mania-miss"}, HTML("miss")),
                    HTML("span", {class: "score-detail-data-text"}, HTML(data.statistics.miss))
                )
            );
            break;
        }
        default:;
    }
}
let lastInitData = null;
const OsuLevelToExp = (n) => {
    if(n <= 100) return 5000 / 3 * (4 * n ** 3 - 3 * n ** 2 - n) + 1.25 * 1.8 ** (n - 60);
    else return 26_931_190_827 + 99_999_999_999 * (n - 100);
}
const OsuExpValToStr = (num) => {
    const exp = Math.log10(num);
    if(exp >= 12){
        return `${(num / 10 ** 12).toPrecision(4)}T`;
    }
    else if(exp >= 9){
        return `${(num / 10 ** 9).toPrecision(4)}B`;
    }
    else if(exp >= 6){
        return `${(num / 10 ** 6).toPrecision(4)}M`;
    }
    else if(exp >= 4){
        return `${(num / 10 ** 3).toPrecision(4)}K`;
    }
    else return `${num}`;
}
const messageCache = new Map();
window.messageCache = messageCache;
const profUrlReg = /https:\/\/(?:osu|lazer)\.ppy\.sh\/users\/[0-9]+(?:|\/osu|\/taiko|\/fruits|\/mania)/;
class SortGroup {
    rules = [];
    constructor(){

    }
    Show = () => {
        if(document.querySelector(".sort-detail__items")) return;
        const h3 = document.querySelector('div.js-sortable--page[data-page-id="top_ranks"] h3.title.title--page-extra-small:nth-child(3)');
        h3.insertAdjacentElement("afterend",
            HTML("div", {class: "sort-detail__items"},
                HTML("div", {class: "sort-detail__item sort-detail__item--title"}, i18n("Sort by")),
            )
        );
    };
    AddRule = (name) => {
        this.rules.push(name);
    };
};
const ImproveProfile = (mulist) => {
    const wloc = window.location.toString();
    if(!profUrlReg.test(wloc)) return;
    //SortGroup.Show();
    const initDataEle = document.querySelector(".js-react--profile-page.osu-layout.osu-layout--full");
    if(!initDataEle) return;
    const initData = JSON.parse(initDataEle.dataset.initialData);
    const userId = initData.user.id, modestr = initData.current_mode;
    if(initData !== lastInitData){
        let ppDiv = null;
        document.querySelectorAll("div.value-display.value-display--plain").forEach((ele) => {
            if(ele.querySelector("div.value-display__label").textContent === "pp") ppDiv = ele;
        });
        if(ppDiv){
            const ttscore = initData.user.statistics.total_score;
            const lvl = initData.user.statistics.level.current;
            const upgradescore = Math.round(OsuLevelToExp(lvl + 1) - OsuLevelToExp(lvl));
            const lvlscore = ttscore - Math.round(OsuLevelToExp(lvl));
            lastInitData = initData;
            document.querySelector("div.bar__text").textContent = `${OsuExpValToStr(lvlscore)}/${OsuExpValToStr(upgradescore)} (${(lvlscore/upgradescore * 100).toPrecision(3)}%)`;
            const _pp = initData.user.statistics.pp;
            ppDiv.querySelector(".value-display__value > div").textContent = _pp >= 1 ? _pp.toPrecision(6) : (_pp < 0.000005 ? 0 : _pp.toFixed(5));
        }
    }
    if(mulist !== undefined) mulist.forEach((record) => {
        if(record.type === "childList" && record.addedNodes) TopRanksWorker(userId, modestr, record.addedNodes);
    });
}
const InsertStyleSheet = () => {
    //const sheetId = "osu-web-enhancement-general-stylesheet";
    const s = new CSSStyleSheet();
    s.replaceSync(inj_style);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, s];
}
const OnBeatmapsetDownload = (message) => {
    beatmapsets.add(message.beatmapsetId);
}
const ImproveBeatmapPlaycountItems = () => {
    for(const item of [...document.querySelectorAll("div.beatmap-playcount")]){
        if(item.getAttribute("improved") !== null) continue;
        item.setAttribute("improved", "");
        const a = item.querySelector("a");
        const bms = bmsReg.exec(a.href);
        if(!bms?.[1]) continue;
        const d = item.querySelector("div.beatmap-playcount__detail");
        const b = HTML("div", {class: "beatmap-playcount__background", style: `background-image: url(https://assets.ppy.sh/beatmaps/${bms[1]}/covers/card@2x.jpg)`});
        if(d.childElementCount > 0) d.insertBefore(b, d.children[0]);
        else d.append(b);
    }
}
const CopyToClipboard = (txt) => {
    navigator.clipboard.writeText(txt).then(() => {
        console.log(txt);
        ShowPopup(i18n("Score details copied to clipboard!"))
    }, (err) => {
        console.log(err);
        ShowPopup(i18n("Unable to copy score detail to clipboard, check console for more info."), "danger")
    });
}
const MakeTextDetail = (data) => {
    let detail = "";
    const s = data.statistics; const m = data.maximum_statistics; const b = data.beatmap;
    const secToMin = (t) => `${Math.floor(t/60)}:${String(t%60).padStart(2, '0')}`;
    const isLazer = IsLazer();
    switch(data.ruleset_id){
        case 0: detail = 
`${(s.great ?? 0) + (s.perfect ?? 0)}-${(s.ok ?? 0) + (s.good ?? 0)}-${s.meh ?? 0}-${s.miss ?? 0} ${data.max_combo ?? 0}${isLazer ? `/${(m.great ?? 0) + (m.legacy_combo_increase ?? 0)}` : ""}x
⭕ ${b.count_circles ?? 0} 🌡️ ${b.count_sliders ?? 0} 🔄 ${b.count_spinners ?? 0}
`; break;
        case 1: detail = 
`${s.great ?? 0}-${s.ok ?? 0}-${s.miss ?? 0} ${data.max_combo ?? 0}/${(s.great ?? 0) + (s.ok ?? 0) + (s.miss ?? 0)}x
🥁 ${b.count_circles ?? 0} 🌡️ ${b.count_sliders ?? 0} 🍥 ${b.count_spinners ?? 0}
`; break;
        case 2: detail = isLazer ? 
`${s.great ?? 0}/${m.great ?? 0}-${s.large_tick_hit ?? 0}/${m.large_tick_hit ?? 0}-${s.small_tick_hit ?? 0}/${m.small_tick_hit ?? 0} ${data.max_combo ?? 0}/${(m.large_tick_hit ?? 0)+(m.great ?? 0)}}x
🍎 ${b.count_circles ?? 0} 💧 ${b.count_sliders ?? 0} 🍌 ${b.count_spinners ?? 0}
` :
`${s.great ?? 0}-${s.large_tick_hit ?? 0}-${s.small_tick_miss ?? 0}-${s.miss ?? 0} ${data.max_combo ?? 0}x
🍎 ${b.count_circles ?? 0} 💧 ${b.count_sliders ?? 0} 🍌 ${b.count_spinners ?? 0}
`; break;
        case 3: detail =
`${s.perfect ?? 0}-${s.great ?? 0}-${s.good ?? 0}-${s.ok ?? 0}-${s.meh ?? 0}-${s.miss ?? 0} ${data.max_combo}${isLazer ? `/${(m.perfect ?? 0) + (m.legacy_combo_increase ?? 0)}` : ""}x
🍚 ${b.count_circles ?? 0} 🍜 ${b.count_sliders ?? 0}
`; break;
        default:;
}
    const scrMsg = 
`${data.beatmapset.title}
 [${data.beatmap.version}] ${secToMin(data.beatmap.total_length)}
${data.total_score} ${data.rank} ${data.pp ? (data.pp >= 1 ? data.pp.toPrecision(5) : (data.pp < 0.00005 ? 0 : data.pp.toFixed(4))) : "-"}pp
${detail}
`;
    return scrMsg;
}
const CopyDetailsPopup = () => {
    const ele = document.querySelector("div.play-detail.play-detail--active"); if(!ele) return;
    const id = ele.dataset.replayId;
    const data = messageCache.get(Number(id)); if(!data) return;
    const msg = MakeTextDetail(data);
    CopyToClipboard(msg);
};
const AddPopupButton = () => {
    const p = document.querySelector("div.js-portal")?.querySelector("div.simple-menu");
    if(!p || p.querySelector("button.score-card-popup-button")) return;
    // p.append(HTML("button", {class: "score-card-popup-button simple-menu__item", type: "button", eventListener: [{type: "click", listener: ShowScoreCardPopup}]}, HTML("Popup")));
    p.append(HTML("button", {class: "score-card-popup-button simple-menu__item", type: "button", eventListener: [{type: "click", listener: CopyDetailsPopup}]}, HTML(i18n("Copy Text Details"))));
};
const OnMutation = (mulist) => {
    mut.disconnect();
    AddMenu();
    FilterBeatmapSet();
    ImproveBeatmapPlaycountItems();
    ImproveProfile(mulist);
    AddPopupButton();
    mut.observe(document, {childList: true, subtree: true});
};
const MessageFilter = (message) => {
    const info = `${message.userId},${message.mode},${message.subdomain}`;
    switch(message.type){
        case "beatmapset_download_complete": OnBeatmapsetDownload(message); break;
        case "top_ranks":
            [message.data.pinned.items, message.data.best.items, message.data.firsts.items].forEach(items => items.forEach(item => {
                messageCache.set(`${info},${item.ended_at}`, item);
                messageCache.set(item.id, item);
            }));
            TopRanksWorker(message.userId, message.mode);
            break;
        case "firsts": case "pinned": case "best": case "recent":
            message.data.forEach(item => { messageCache.set(`${info},${item.ended_at}`, item); messageCache.set(item.id, item); });
            TopRanksWorker(message.userId, message.mode);
            break;
        case "historical":
            message.data.recent.items.forEach(item => { messageCache.set(`${info},${item.ended_at}`, item); messageCache.set(item.id, item); });
            TopRanksWorker(message.userId, message.mode);
            break;
        default:;
    }
}
const WindowMessageFilter = (event) => {
    if(event.source === window && event?.data?.id === "osu!web enhancement"){
        MessageFilter(event.data);
    }
}
const OnClick = (event) => {
    let t = event.target;
    while(t){
        if(t.tagName === "A"){
            const e = bmsdlReg.exec(t.href);
            if(!e) continue;
            beatmapsets.add(Number(e[1]));
            FilterBeatmapSet();
            break;
        }
        t = t.parentElement;
    }
}
//document.addEventListener("click", OnClick);
const curLocale = window.currentLocale;
if (curLocale && locales[curLocale]) {
    console.log("localization available");
    i18n.translator.add(locales[curLocale]);
}
window.addEventListener("message", WindowMessageFilter);
const mut = new MutationObserver(OnMutation);
mut.observe(document, {childList: true, subtree: true});
InsertStyleSheet();
console.log("osu!web enhancement loaded");
// below are test code
/*
const osusrc = "https://i.ppy.sh/bde5906f8f985126f4ea624d3eb14c8702883aa2/68747470733a2f2f6f73752e7070792e73682f77696b692f696d616765732f536b696e6e696e672f496e746572666163652f696d672f6d6f64652d6f73752e706e67";
const taikosrc = "https://i.ppy.sh/c1a9502ea05c9fcde03a375ebf528a12ff30cae7/68747470733a2f2f6f73752e7070792e73682f77696b692f696d616765732f536b696e6e696e672f496e746572666163652f696d672f6d6f64652d7461696b6f2e706e67";
const fruitsrc = "https://i.ppy.sh/e7cad0470810a868df06d597e3441812659c0bfa/68747470733a2f2f6f73752e7070792e73682f77696b692f696d616765732f536b696e6e696e672f496e746572666163652f696d672f6d6f64652d6672756974732e706e67";
const maniasrc = "https://i.ppy.sh/55d9494fcf7c3ef2d614695a9a951977a21f23f6/68747470733a2f2f6f73752e7070792e73682f77696b692f696d616765732f536b696e6e696e672f496e746572666163652f696d672f6d6f64652d6d616e69612e706e67";
const pngsrc = [osusrc, taikosrc, fruitsrc, maniasrc];
const png = [null, null, null, null];
let canvas, ctx, cw, ch;
const ToggleSnow = async (modeid) => {
    if(canvas) {canvas.remove(); return;}
    canvas = HTML("canvas", {style: `position: fixed; bottom: 0px; left: 0px;`, width: window.innerWidth, height: window.innerHeight});
    document.body.append(canvas);
    ctx = canvas.getContext("webgl2");
    if(!png[modeid]){
        const response = await fetch(pngsrc[modeid]);
        png[modeid] = await response.blob();
    }
}
*/
