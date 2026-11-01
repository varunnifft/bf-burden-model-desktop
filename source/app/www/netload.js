/* Load an input file from a web link (Google Sheets, Google Drive, OneDrive/SharePoint, Dropbox or any direct file link).
   The app downloads the file once, then reads it on the device exactly like a chosen file; nothing is uploaded.
   Phone app: downloaded by the Android shell (no browser CORS limit). Desktop app: by the Electron main process.
   Plain browser: fetch(), which works only when the site allows it (CORS). */
(function () {
  'use strict';
  var LAST = 'bf-last-link', MAX = 30 * 1024 * 1024;

  /** Share links -> direct download links */
  function direct(url) {
    var u = String(url || '').trim(), m;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/+/, '');
    if ((m = u.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/))) {
      var gid = (u.match(/[#&?]gid=(\d+)/) || [])[1];
      return 'https://docs.google.com/spreadsheets/d/' + m[1] + '/export?format=xlsx' + (gid ? '&gid=' + gid : '');
    }
    if ((m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]+)/))) return 'https://drive.google.com/uc?export=download&id=' + m[1];
    if (/dropbox\.com\//.test(u)) return /[?&]dl=/.test(u) ? u.replace(/([?&])dl=\d/, '$1dl=1') : u + (u.indexOf('?') < 0 ? '?' : '&') + 'dl=1';
    if (/(1drv\.ms|onedrive\.live\.com|sharepoint\.com)/.test(u) && !/[?&]download=1/.test(u)) return u + (u.indexOf('?') < 0 ? '?' : '&') + 'download=1';
    return u;
  }

  /** A sensible file name: from the server, else the link, else the file's first bytes */
  function nameFor(url, given, b) {
    var n = (given || '').replace(/^.*[\\/]/, '').trim();
    if (!n) { try { n = decodeURIComponent(new URL(url).pathname.split('/').pop() || ''); } catch (e) { n = ''; } }
    if (/docs\.google\.com\/spreadsheets/.test(url) && !/\.xlsx$/i.test(n)) n = 'google-sheet.xlsx';
    if (!/\.[a-z0-9]{2,5}$/i.test(n)) {
      var ext = b[0] === 0x50 && b[1] === 0x4b ? '.xlsx' : b[0] === 0xd0 && b[1] === 0xcf ? '.xls' : b[0] === 0x25 && b[1] === 0x50 ? '.pdf' : '.csv';
      n = (n || 'linked-file') + ext;
    }
    return n;
  }
  function looksLikeWebPage(b) {
    var s = ''; for (var i = 0; i < Math.min(b.length, 400); i++) s += String.fromCharCode(b[i]);
    return /^\s*(<!doctype html|<html)/i.test(s);
  }

  var waits = {}, seq = 0;
  window.__bfLinkDone = function (id, ok, data, name) {      // called by the Android shell
    var w = waits[id]; if (!w) return; delete waits[id];
    if (!ok) return w.no(new Error(data || 'download failed'));
    var bin = atob(data), b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    w.ok({ bytes: b, name: name || '' });
  };

  function download(url) {
    if (window.Android && window.Android.fetchUrl) {
      return new Promise(function (ok, no) { var id = 'L' + (++seq); waits[id] = { ok: ok, no: no }; window.Android.fetchUrl(url, id); });
    }
    if (window.bfNet && window.bfNet.fetchUrl) {
      return window.bfNet.fetchUrl(url).then(function (r) { if (!r.ok) throw new Error(r.error || 'download failed'); return { bytes: new Uint8Array(r.data), name: r.name || '' }; });
    }
    return fetch(url, { redirect: 'follow' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var cd = r.headers.get('content-disposition') || '', m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      return r.arrayBuffer().then(function (a) { return { bytes: new Uint8Array(a), name: m ? decodeURIComponent(m[1]) : '' }; });
    });
  }

  /** Resolves to a File, ready for the same reader as the file picker */
  function load(link) {
    var url = direct(link);
    try { localStorage.setItem(LAST, String(link).trim()); } catch (e) { }
    return download(url).then(function (r) {
      if (!r.bytes.length) throw new Error('the link returned an empty file');
      if (r.bytes.length > MAX) throw new Error('the file is larger than 30 MB');
      if (looksLikeWebPage(r.bytes)) throw new Error('the link opened a web page, not a file. Share the file as "Anyone with the link" and use its download link');
      return new File([r.bytes], nameFor(url, r.name, r.bytes));
    }, function (e) {
      var m = (e && e.message) || String(e);
      if (/Failed to fetch|NetworkError|Load failed/i.test(m)) m = 'no internet connection, or the site does not allow the app to download it';
      throw new Error(m);
    });
  }
  function last() { try { return localStorage.getItem(LAST) || ''; } catch (e) { return ''; } }

  window.BFUrl = { load: load, direct: direct, last: last };
})();
