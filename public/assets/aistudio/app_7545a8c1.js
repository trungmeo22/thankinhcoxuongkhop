/* Đơn nguyên Cơ xương khớp – webapp
 * Giao diện + logic: phần TEMPLATE và class Component bên dưới (sinh từ bản thiết kế).
 * Đồng bộ dữ liệu: SYNC (Supabase). Đăng nhập: Login / Root.
 */
(function () {
  'use strict';
  var h = preact.h, render = preact.render, PComponent = preact.Component;
  var html = htm.bind(h);
  var CFG = window.APP_CONFIG || {};
  var sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cxk-auth' }
  });

  function uid() { return Date.now() * 1000 + Math.floor(Math.random() * 1000); }

  /* ---------------- Đồng bộ dữ liệu với Supabase ---------------- */
  var TABLES = ['patients', 'recs', 'scheds', 'reports'];
  var TS = {
    patients: function (o) { return o.admitAt || null; },
    recs: function (o) { return o.at || null; },
    scheds: function () { return null; },
    reports: function (o) { return o.savedAt || null; },
    settings: function () { return null; }
  };
  var badgeListeners = [];
  var SYNC = {
    app: null, last: {}, lastBeds: undefined, pending: new Map(), timer: null, flushing: false,
    status: 'ok', channel: null,
    seed: function (data) {
      var self = this;
      TABLES.forEach(function (t) { self.last[t] = new Map(); (data[t] || []).forEach(function (o) { self.last[t].set(o.id, o); }); });
      this.lastBeds = data.beds != null ? data.beds : null;
      this.pending.clear();
    },
    attach: function (app) { this.app = app; this.subscribe(); },
    detach: function () { this.app = null; if (this.channel) { sb.removeChannel(this.channel); this.channel = null; } clearTimeout(this.timer); },
    setStatus: function (st) { if (this.status !== st) { this.status = st; badgeListeners.forEach(function (f) { f(); }); } },
    push: function (state) {
      var self = this;
      TABLES.forEach(function (t) {
        var m = self.last[t], seen = new Set();
        (state[t] || []).forEach(function (o) {
          seen.add(o.id);
          if (m.get(o.id) !== o) { m.set(o.id, o); self.pending.set(t + ':' + o.id, { t: t, id: o.id, obj: o }); }
        });
        Array.from(m.keys()).forEach(function (id) {
          if (!seen.has(id)) { m.delete(id); self.pending.set(t + ':' + id, { t: t, id: id, obj: null }); }
        });
      });
      var beds = state.beds == null ? null : state.beds;
      if (beds !== this.lastBeds) { this.lastBeds = beds; this.pending.set('settings:1', { t: 'settings', id: 1, obj: { beds: beds } }); }
      if (this.pending.size) { this.setStatus('saving'); this.schedule(400); }
    },
    schedule: function (ms) { var self = this; clearTimeout(this.timer); this.timer = setTimeout(function () { self.flush(); }, ms); },
    flush: async function () {
      if (this.flushing) { this.schedule(300); return; }
      if (!this.pending.size) { this.setStatus('ok'); return; }
      this.flushing = true; this.setStatus('saving');
      var self = this, items = Array.from(this.pending.values()), failed = false, groups = {};
      items.forEach(function (it) {
        var g = groups[it.t] || (groups[it.t] = { ups: [], dels: [] });
        if (it.obj) g.ups.push(it); else g.dels.push(it);
      });
      var now = new Date().toISOString();
      for (var t in groups) {
        var g = groups[t];
        try {
          if (g.ups.length) {
            var rows = g.ups.map(function (it) { return { id: it.id, data: it.obj, ts: TS[t](it.obj), updated_at: now }; });
            var r1 = await sb.from(t).upsert(rows);
            if (r1.error) throw r1.error;
            g.ups.forEach(function (it) { if (self.pending.get(t + ':' + it.id) === it) self.pending.delete(t + ':' + it.id); });
          }
          if (g.dels.length) {
            var r2 = await sb.from(t).delete().in('id', g.dels.map(function (it) { return it.id; }));
            if (r2.error) throw r2.error;
            g.dels.forEach(function (it) { if (self.pending.get(t + ':' + it.id) === it) self.pending.delete(t + ':' + it.id); });
          }
        } catch (e) { failed = true; console.warn('Lỗi lưu ' + t, e); }
      }
      this.flushing = false;
      if (failed) { this.setStatus('err'); this.schedule(5000); }
      else if (this.pending.size) this.schedule(200);
      else this.setStatus('ok');
    },
    subscribe: function () {
      var self = this;
      if (this.channel) sb.removeChannel(this.channel);
      this.channel = sb.channel('cxk-db')
        .on('postgres_changes', { event: '*', schema: 'public' }, function (p) { self.remote(p); })
        .subscribe();
    },
    remote: function (p) {
      var app = this.app, t = p.table, self = this;
      if (!app) return;
      if (t === 'settings') {
        if (p.new && p.new.data && !this.pending.has('settings:1')) {
          var b = p.new.data.beds == null ? null : p.new.data.beds;
          this.lastBeds = b; app.setState({ beds: b });
        }
        return;
      }
      if (TABLES.indexOf(t) < 0) return;
      var id = p.new && p.new.id != null ? p.new.id : (p.old && p.old.id);
      if (id == null || this.pending.has(t + ':' + id)) return;
      if (p.eventType === 'DELETE') {
        if (!this.last[t].has(id)) return;
        this.last[t].delete(id);
        app.setState(function (st) { var o = {}; o[t] = st[t].filter(function (x) { return x.id !== id; }); return o; });
        return;
      }
      var obj = p.new.data, cur = this.last[t].get(id);
      if (!obj || (cur && JSON.stringify(cur) === JSON.stringify(obj))) return;
      this.last[t].set(id, obj);
      app.setState(function (st) {
        var arr = st[t], found = false;
        var n = arr.map(function (x) { if (x.id === id) { found = true; return obj; } return x; });
        if (!found) n = n.concat([obj]);
        if (t === 'reports') n = n.slice().sort(function (a, b) { return b.savedAt - a.savedAt; });
        var o = {}; o[t] = n; return o;
      });
    }
  };
  window.addEventListener('beforeunload', function (e) {
    if (SYNC.pending.size) { e.preventDefault(); e.returnValue = ''; }
  });

  async function fetchAll(t, since) {
    var out = [], from = 0;
    for (;;) {
      var q = sb.from(t).select('id,data').order('id').range(from, from + 999);
      if (since) q = q.gte('ts', since);
      var res = await q;
      if (res.error) throw res.error;
      out = out.concat(res.data.map(function (r) { return r.data; }).filter(Boolean));
      if (res.data.length < 1000) break;
      from += 1000;
    }
    return out;
  }
  async function loadAll() {
    var since = Date.now() - (CFG.RECORD_DAYS || 180) * 86400000;
    var res = await Promise.all([fetchAll('patients'), fetchAll('recs', since), fetchAll('scheds'), fetchAll('reports'),
      sb.from('settings').select('id,data').eq('id', 1).maybeSingle()]);
    if (res[4].error) throw res[4].error;
    var beds = res[4].data && res[4].data.data ? res[4].data.data.beds : null;
    return { patients: res[0], recs: res[1], scheds: res[2], reports: res[3], beds: beds == null ? null : beds };
  }

  /* ---------------- Ô trạng thái lưu & bảng tài khoản ---------------- */
  class SyncBadge extends PComponent {
    componentDidMount() { var self = this; this.f = function () { self.forceUpdate(); }; badgeListeners.push(this.f); }
    componentWillUnmount() { var i = badgeListeners.indexOf(this.f); if (i >= 0) badgeListeners.splice(i, 1); }
    render() {
      var st = SYNC.status;
      var txt = st === 'ok' ? 'Đã lưu' : st === 'saving' ? 'Đang lưu…' : 'Mất kết nối – đang thử lưu lại';
      return html`<div class=${'sync sync-' + st} role="status"><span class="sync-dot" aria-hidden="true"></span>${txt}</div>`;
    }
  }
  class SysPanel extends PComponent {
    constructor(p) { super(p); this.state = { pw: '', pw2: '', msg: '', err: '', busy: false }; }
    async change(e) {
      e.preventDefault();
      var pw = this.state.pw.trim();
      if (pw.length < 3) { this.setState({ err: 'Mật khẩu mới cần ít nhất 3 ký tự.', msg: '' }); return; }
      if (pw !== this.state.pw2.trim()) { this.setState({ err: 'Hai lần nhập không khớp.', msg: '' }); return; }
      this.setState({ busy: true, err: '', msg: '' });
      var r = await sb.auth.updateUser({ password: (CFG.PASSWORD_PREFIX || '') + pw });
      if (r.error) this.setState({ busy: false, err: 'Không đổi được mật khẩu: ' + r.error.message });
      else this.setState({ busy: false, pw: '', pw2: '', msg: 'Đã đổi mật khẩu. Báo cho mọi người trong khoa mật khẩu mới.' });
    }
    render() {
      var s = this.state, self = this;
      return html`<section class="card sys">
        <div><h3>Mật khẩu &amp; đăng xuất</h3><p class="muted">Mật khẩu dùng chung cho cả đơn nguyên.</p></div>
        <form class="sys-row" onSubmit=${function (e) { self.change(e); }}>
          <label class="sr" for="np1">Mật khẩu mới</label>
          <input id="np1" class="in in-c" type="password" autocomplete="new-password" placeholder="Mật khẩu mới" value=${s.pw} onInput=${function (e) { self.setState({ pw: e.target.value, err: '' }); }} />
          <label class="sr" for="np2">Nhập lại mật khẩu mới</label>
          <input id="np2" class="in in-c" type="password" autocomplete="new-password" placeholder="Nhập lại" value=${s.pw2} onInput=${function (e) { self.setState({ pw2: e.target.value, err: '' }); }} />
          <button type="submit" class="btn-o" disabled=${s.busy}>${s.busy ? 'Đang đổi…' : 'Đổi mật khẩu'}</button>
          <button type="button" class="btn-g" onClick=${function () { sb.auth.signOut(); }}>Đăng xuất</button>
        </form>
        ${s.err ? html`<p class="err">${s.err}</p>` : null}
        ${s.msg ? html`<p class="ok-msg">${s.msg}</p>` : null}
      </section>`;
    }
  }

  /* ---------------- Giao diện (sinh từ bản thiết kế) ---------------- */
  class DCLogic extends PComponent {
    render() { return TEMPLATE(this.renderVals()); }
  }
function TEMPLATE(v) {
  return html`

<div style="min-height: 100vh; background: #F3F4F1">

<header class="hero">
<img class=${v?.sc?.s0} src="img/scene1.svg" alt="" />
<img class=${v?.sc?.s1} src="img/scene2.svg" alt="" />
<img class=${v?.sc?.s2} src="img/scene3.svg" alt="" />
<img class=${v?.sc?.s3} src="img/scene4.svg" alt="" />
<div class="wrap" style="position: relative; height: 100%; display: flex; align-items: center">
<div class="brandbox" style="display: flex; align-items: center; gap: 12px; background: rgba(255, 255, 255, 0.9); border-radius: 14px; padding: 10px 16px 10px 10px; box-shadow: 0 2px 10px rgba(15, 47, 42, 0.12)">
<div style="width: 42px; height: 42px; border-radius: 11px; background: #0F2F2A; display: flex; align-items: center; justify-content: center; flex: none" aria-hidden="true">
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E6F2EE" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5a2 2 0 1 0-2.5 2.5L9 10.5"></path><path d="M17 20.5a2 2 0 1 0 2.5-2.5L15 13.5"></path><circle cx="12" cy="12" r="2.6"></circle></svg>
</div>
<div>
<div class="brand-t" style="font-weight: 700; font-size: 18px; line-height: 1.25; color: #0F2F2A">Đơn nguyên Cơ xương khớp</div>
<div style="font-size: 13px; color: #3A4540">${v?.nowLong}</div>
${v?.syncBadge}
</div>
</div>
</div>
</header>
<div class="tabbar">
<div class="wrap">
<nav class="tabs" aria-label="Chức năng" style="display: flex; gap: 4px; padding-top: 6px; padding-bottom: 6px">
${(v?.tabs || []).map((t, $index) => html`
<button type="button" class=${t?.cls} onClick=${t?.go}><span class="t-long">${t?.label}</span><span class="t-short">${t?.short}</span>${t?.hasBadge ? html`<span class="badge">${t?.badge}</span>` : null}</button>
`)}
</nav>
</div>
</div>

<main class="wrap" style="padding-top: 20px; padding-bottom: 104px">

${v?.isDash ? html`
<div style="display: flex; flex-direction: column; gap: 20px">
<div class="kpis" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px">
<div class="card kpi kpi-wide" style="padding: 16px; display: flex; flex-direction: column; gap: 8px">
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px"><span class="lbl">Công suất giường</span><span style="font-size: 13px; color: #56615C">${v?.bedText}</span></div>
<div class="kpi-n" style="font-size: 34px; font-weight: 700; line-height: 1.1">${v?.occPct}%</div>
<div style="height: 10px; border-radius: 5px; background: #E6E9E5; overflow: hidden"><div style=${"height: 10px; border-radius: 5px; width: " + String(v?.occW ?? "") + "%; background: " + String(v?.occColor ?? "")}></div></div>
<div class="kpi-hide" style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #56615C">
<label for="beds">Tổng số giường</label>
<input id="beds" class="in" type="number" min="1" style="width: 84px; min-height: 36px; padding: 4px 8px" value=${v?.bedsVal} onInput=${v?.on?.beds} />
</div>
</div>
<div class="card kpi" style="padding: 16px"><span class="lbl">Đang điều trị</span><div class="kpi-n" style="font-size: 34px; font-weight: 700; line-height: 1.2">${v?.activeCount}</div><p class="muted kpi-hide">Còn trống ${v?.freeBeds} giường</p></div>
<div class="card kpi" style="padding: 16px"><span class="lbl">Vào viện hôm nay</span><div class="kpi-n" style="font-size: 34px; font-weight: 700; line-height: 1.2; color: #0A6E5E">${v?.inToday}</div><p class="muted kpi-hide">7 ngày qua: ${v?.in7}</p></div>
<div class="card kpi" style="padding: 16px; display: flex; flex-direction: column; gap: 6px"><span class="lbl">Ra viện hôm nay</span><div class="kpi-n" style="font-size: 34px; font-weight: 700; line-height: 1.2; color: #A4521A">${v?.outToday}</div><p class="muted kpi-hide">7 ngày qua: ${v?.out7} · chờ ra: ${v?.pendingCount}</p><button type="button" class="btn-o kpi-hide" onClick=${v?.openOutList} style="margin-top: auto">Danh sách báo ra viện</button></div>
<div class="card kpi" style="padding: 16px"><span class="lbl">Chỉ định hôm nay</span><div class="kpi-n" style="font-size: 34px; font-weight: 700; line-height: 1.2">${v?.procToday}</div><p class="muted kpi-hide">${v?.procSplit}</p></div>
</div>

<div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: stretch">
<section class="card" style="flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px">
<div><h2>Bệnh nhân điều trị, vào & ra viện</h2><p class="muted">14 ngày gần nhất · nét đứt = ${v?.bedsVal} giường</p></div>
<div style="display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; color: #3A4540">
<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 12px; height: 12px; border-radius: 3px; background: #BCD9D2"></span>Tổng BN (cột)</span>
<span style="display: inline-flex; align-items: center; gap: 6px"><span style="position: relative; width: 22px; height: 12px; display: inline-block"><span style="position: absolute; left: 0; right: 0; top: 5px; height: 2px; background: #2A6FBF"></span><span style="position: absolute; left: 6px; top: 1px; width: 10px; height: 10px; border-radius: 50%; background: #2A6FBF; box-shadow: 0 0 0 2px #fff"></span></span>Vào viện</span>
<span style="display: inline-flex; align-items: center; gap: 6px"><span style="position: relative; width: 22px; height: 12px; display: inline-block"><span style="position: absolute; left: 0; right: 0; top: 5px; height: 2px; background: #D9782B"></span><span style="position: absolute; left: 6px; top: 1px; width: 10px; height: 10px; border-radius: 50%; background: #D9782B; box-shadow: 0 0 0 2px #fff"></span></span>Ra viện</span>
</div>
</div>
<div style="overflow-x: auto">
<div style="min-width: 560px">
<div style="position: relative; display: flex; height: 190px; align-items: flex-end; border-bottom: 1px solid #C3CAC4">
<div style=${"position: absolute; left: 0; right: 0; bottom: " + String(v?.capY ?? "") + "px; border-top: 2px dashed #8A948F"} aria-hidden="true"></div>
${(v?.series || []).map((d, $index) => html`
<div class="grp bar-col" title=${d?.tip} style="position: relative; height: 100%; padding: 0 4px; border-radius: 6px 6px 0 0"><span class="bar-n">${d?.census}</span><div style=${"width: 100%; max-width: 30px; height: " + String(d?.cenH ?? "") + "px; background: #BCD9D2; border-radius: 4px 4px 0 0"}></div></div>
`)}
<svg viewBox="0 0 1400 160" preserveAspectRatio="none" aria-hidden="true" style="position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 160px; overflow: visible; pointer-events: none"><polyline points=${v?.inPts} fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline><polyline points=${v?.inPts} fill="none" stroke="#2A6FBF" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline><polyline points=${v?.outPts} fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline><polyline points=${v?.outPts} fill="none" stroke="#D9782B" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline></svg>
<div style="position: absolute; inset: 0; display: flex; pointer-events: none">
${(v?.series || []).map((d, $index) => html`
<div style="flex: 1; position: relative"><span style=${"position: absolute; left: 50%; bottom: " + String(d?.inDot ?? "") + "px; width: 9px; height: 9px; margin-left: -4.5px; border-radius: 50%; background: #2A6FBF; box-shadow: 0 0 0 2px #fff"}></span><span style=${"position: absolute; left: 50%; bottom: " + String(d?.outDot ?? "") + "px; width: 9px; height: 9px; margin-left: -4.5px; border-radius: 50%; background: #D9782B; box-shadow: 0 0 0 2px #fff"}></span></div>
`)}
</div>
</div>
<div style="display: flex; gap: 0; padding-top: 6px">
${(v?.series || []).map((d, $index) => html`<div class=${d?.lblCls} style="flex: 1">${d?.label}</div>`)}
</div>
</div>
</div>
</section>

<aside style="flex: 1 1 320px; min-width: 0; display: flex; flex-direction: column; gap: 20px">
<section class="card" style="padding: 14px 16px; display: flex; flex-direction: column; gap: 10px">
<div><h3>Báo cáo giao ban</h3><p class="muted">Tổng hợp tự động: bệnh nhân, DHST, chỉ định, ra viện.</p></div>
<button type="button" class="btn" onClick=${v?.copyGb}>${v?.copyGbLabel}</button>
${v?.copyFailGb ? html`<p class="err">Trình duyệt chặn sao chép — bôi đen văn bản dưới đây để chép.</p><pre class="txt">${v?.gbText}</pre>` : null}
</section>
<section class="card" style="padding: 0; overflow: hidden">
<div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid #E6E9E5"><h3>Mới nhập viện (24h) · ${v?.newCount}</h3><button type="button" class="btn-g" onClick=${v?.goBn}>Xem tất cả</button></div>
${v?.noNew ? html`<p class="muted" style="padding: 14px 16px">Chưa có bệnh nhân mới.</p>` : null}
${(v?.newList || []).map((p, $index) => html`
<div class="prow"><span class="room">${p?.room}</span><div style="flex: 1 1 120px; min-width: 0"><div style="font-weight: 600">${p?.name}</div><div class="muted">${p?.age} · vào ${p?.admit}</div></div></div>
`)}
</section>
<section class="card" style="padding: 0; overflow: hidden">
<div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid #E6E9E5"><h3>Chỉ định hôm nay</h3><button type="button" class="btn-g" onClick=${v?.goLich}>Mở lịch</button></div>
${v?.noTodayP ? html`<p class="muted" style="padding: 14px 16px">Không có lịch hôm nay.</p>` : null}
${(v?.todayItems || []).map((x, $index) => html`
<div class="prow"><strong style="min-width: 46px">${x?.time}</strong><span class=${x?.tagCls}>${x?.typeLabel}</span><span style="flex: 1 1 120px; min-width: 0; font-size: 14px">${x?.patient}</span>${x?.done ? html`<span class="tag tag-done">Đã làm</span>` : null}</div>
`)}
</section>
</aside>
</div>
</div>
` : null}

${v?.isDash ? html`${v?.sysPanel}` : null}

${v?.isBn ? html`
<div style="display: flex; flex-direction: column; gap: 16px">
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px">
<h2>${v?.bnTitle}</h2>
<div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center">
<label for="pt-q" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Tìm bệnh nhân</label>
<input id="pt-q" class="in" type="search" style="width: 220px" value=${v?.q} onInput=${v?.on?.q} placeholder="Tìm tên hoặc phòng" />
<button type="button" class="btn-o" onClick=${v?.toggleOut}>${v?.outBtnLabel}</button>
<button type="button" class="btn" onClick=${v?.openAdmit}>+ Nhập viện</button>
</div>
</div>

${v?.showIn ? html`
<section class="card" style="padding: 0; overflow: hidden">
<div style="padding: 14px 16px; border-bottom: 1px solid #E6E9E5; display: flex; align-items: center; gap: 8px"><span class="tag tag-new">Mới</span><h3>Mới nhập viện (24h) · ${v?.newCount}</h3></div>
${v?.noNewQ ? html`<p class="muted" style="padding: 14px 16px">Không có.</p>` : null}
${(v?.newRows || []).map((p, $index) => html`
<div class="prow">
<span class="room">${p?.room}</span>
<button type="button" class="pbtn" onClick=${p?.editInfo} aria-label=${"Sửa thông tin " + String(p?.name ?? "")}><span style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: #17201D">${p?.name}<svg class="pen" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"></path></svg></span><span class="muted" style="display: block">${p?.age} · vào ${p?.admit}</span>${p?.pending ? html`<span class="tag tag-new" style="display: inline-block; margin-top: 4px">${p?.pendingText}</span>` : null}</button>
<div style="display: flex; flex-wrap: wrap; gap: 8px">
<button type="button" class="btn-o" onClick=${p?.dhst}>DHST/Diễn biến</button>
<button type="button" class="btn-o" onClick=${p?.order}>Chỉ định</button>
<button type="button" class=${p?.outCls} onClick=${p?.discharge}>${p?.outLabel}</button>
${p?.confirming ? html`<button type="button" class="btn-g" onClick=${v?.cancelOut}>Hủy</button>` : null}
</div>
</div>
`)}
</section>
<section class="card" style="padding: 0; overflow: hidden">
<div style="padding: 14px 16px; border-bottom: 1px solid #E6E9E5"><h3>Bệnh nhân hiện có · ${v?.oldCount}</h3></div>
${v?.noOldQ ? html`<p class="muted" style="padding: 14px 16px">Không có.</p>` : null}
${(v?.oldRows || []).map((p, $index) => html`
<div class="prow">
<span class="room">${p?.room}</span>
<button type="button" class="pbtn" onClick=${p?.editInfo} aria-label=${"Sửa thông tin " + String(p?.name ?? "")}><span style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: #17201D">${p?.name}<svg class="pen" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"></path></svg></span><span class="muted" style="display: block">${p?.age} · vào ${p?.admit}</span>${p?.pending ? html`<span class="tag tag-new" style="display: inline-block; margin-top: 4px">${p?.pendingText}</span>` : null}</button>
<div style="display: flex; flex-wrap: wrap; gap: 8px">
<button type="button" class="btn-o" onClick=${p?.dhst}>DHST/Diễn biến</button>
<button type="button" class="btn-o" onClick=${p?.order}>Chỉ định</button>
<button type="button" class=${p?.outCls} onClick=${p?.discharge}>${p?.outLabel}</button>
${p?.confirming ? html`<button type="button" class="btn-g" onClick=${v?.cancelOut}>Hủy</button>` : null}
</div>
</div>
`)}
</section>
` : null}

${v?.showOut ? html`
<section class="card" style="padding: 0; overflow: hidden">
<div style="padding: 14px 16px; border-bottom: 1px solid #E6E9E5; display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center"><h3>Đã báo ra viện · ${v?.outCount}</h3>${v?.hasPending ? html`<span class="tag tag-new">${v?.pendingCount} chờ ra viện</span>` : null}</div>
${v?.noOutQ ? html`<p class="muted" style="padding: 14px 16px">Chưa có bệnh nhân báo ra viện.</p>` : null}
${(v?.outRows || []).map((p, $index) => html`
<div class="prow">
<span class="room" style=${p?.roomStyle}>${p?.room}</span>
<div style="flex: 1 1 220px; min-width: 0; display: flex; flex-direction: column; gap: 2px">
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px"><strong>${p?.name}</strong><span class=${p?.tagCls}>${p?.tag}</span></div>
<div style="font-size: 14px; color: #2B3531">Ra viện: <strong>${p?.out}</strong></div>
<div class="muted">${p?.age} · vào ${p?.admit} · ${p?.los}</div>
${p?.hasNote ? html`<div style="font-size: 14px; color: #2B3531; background: #F3F4F1; border-radius: 8px; padding: 6px 10px; margin-top: 4px">${p?.note}</div>` : null}
</div>
<div style="display: flex; gap: 6px"><button type="button" class="btn-g" onClick=${p?.dhst}>DHST/Diễn biến</button><button type="button" class="btn-g" onClick=${p?.edit}>Sửa</button></div>
</div>
`)}
</section>
` : null}
</div>
` : null}

${v?.isGb ? html`
<section class="card" style="display: flex; flex-direction: column; gap: 20px">
<div style="display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px">
<div>
<h2>Báo cáo giao ban</h2>
<p class="muted">${v?.todayLong} · Tự động tổng hợp từ danh sách bệnh nhân và lịch chỉ định</p>
</div>
<button type="button" class="btn" onClick=${v?.copyGb}>${v?.copyGbLabel}</button>
</div>
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px">
${(v?.stats || []).map((s, $index) => html`
<div class=${s?.cls}><div style="font-size: 28px; font-weight: 700; line-height: 1.15">${s?.n}</div><div style="font-size: 13px">${s?.label}</div></div>
`)}
</div>
<div style="display: flex; flex-direction: column; gap: 10px">
<h3>Danh sách bệnh nhân đang điều trị</h3>
<div style="overflow-x: auto; border: 1px solid #DDE1DC; border-radius: 12px">
<div class="tr th"><div>#</div><div>Họ tên</div><div>Tuổi</div><div>Phòng</div><div>Giờ nhập</div><div>Mạch</div><div>HA</div><div>Nhiệt</div><div>SpO₂</div><div>NT</div><div>Ghi chú</div></div>
${(v?.gbRows || []).map((r, $index) => html`
<div class="tr"><div>${r?.stt}</div><div style="font-weight: 600">${r?.name}</div><div>${r?.age}</div><div>${r?.room}</div><div>${r?.admit}</div><div class=${r?.m?.cls}>${r?.m?.text}</div><div class=${r?.ha?.cls}>${r?.ha?.text}</div><div class=${r?.t?.cls}>${r?.t?.text}</div><div class=${r?.o?.cls}>${r?.o?.text}</div><div class=${r?.r?.cls}>${r?.r?.text}</div><div>${r?.note}</div></div>
`)}
</div>
</div>
<div style="display: flex; flex-wrap: wrap; gap: 20px">
<div style="flex: 1 1 360px; min-width: 0; display: flex; flex-direction: column; gap: 8px">
<h3>Chỉ định hôm nay</h3>
${v?.noTodayP ? html`<p class="muted">Không có lịch tiêm khớp / điện cơ hôm nay.</p>` : null}
${(v?.todayItems || []).map((x, $index) => html`
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 12px; border: 1px solid #E6E9E5; border-radius: 10px">
<strong style="min-width: 48px">${x?.time}</strong><span class=${x?.tagCls}>${x?.typeLabel}</span><span style="flex: 1 1 160px">${x?.patient} · ${x?.site}</span>${x?.done ? html`<span class="tag tag-done">Đã làm</span>` : null}
</div>
`)}
</div>
<div style="flex: 1 1 360px; min-width: 0; display: flex; flex-direction: column; gap: 8px">
<h3>Bệnh nhân DHST bất thường</h3>
${v?.noBad ? html`<p class="muted">Không có.</p>` : null}
${(v?.badItems || []).map((b, $index) => html`
<div style="padding: 10px 12px; border-radius: 10px; background: #FDF0E5; color: #5E2603; font-size: 14px"><strong>${b?.who}</strong> — ${b?.text}</div>
`)}
</div>
</div>
${v?.copyFailGb ? html`
<div style="display: flex; flex-direction: column; gap: 8px"><p class="err">Trình duyệt chặn sao chép tự động — hãy bôi đen văn bản dưới đây để sao chép.</p><pre class="txt">${v?.gbText}</pre></div>
` : null}
</section>
` : null}

${v?.isTruc ? html`
<div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start">
<section class="card" style="flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column; gap: 16px">
<div>
<h2>${v?.dTitle}</h2>
<p class="muted">${v?.dWindow} · số liệu tự tính từ danh sách bệnh nhân</p>
</div>
${v?.isEditing ? html`
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; background: #FFF4E8; color: #6B3207; border-radius: 10px; padding: 8px 12px; font-size: 14px"><span>Đang sửa báo cáo đã lưu</span><button type="button" class="btn-g" onClick=${v?.cancelEdit}>Hủy sửa</button></div>
` : null}
<div class="g3" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px">
<div class="f"><label class="lbl" for="d-date">Ngày trực</label><input id="d-date" class="in" type="date" value=${v?.duty?.date} onInput=${v?.on?.dDate} /></div>
<div class="f"><label class="lbl" for="d-doc">Bác sĩ trực *</label><input id="d-doc" class="in" type="text" value=${v?.duty?.doctor} onInput=${v?.on?.dDoctor} /></div>
<div class="f"><label class="lbl" for="d-nur">Điều dưỡng trực</label><input id="d-nur" class="in" type="text" value=${v?.duty?.nurse} onInput=${v?.on?.dNurse} /></div>
</div>
<div class="dstats" style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px">
${(v?.dStats || []).map((s, $index) => html`
<div class=${s?.cls} style="padding: 10px 8px; text-align: center"><div class="ds-l" style="font-size: 12px; font-weight: 600">${s?.label}</div><div class="ds-n" style="font-size: 24px; font-weight: 700; line-height: 1.2">${s?.n}</div></div>
`)}
</div>
<div style="border: 1px solid #DDE1DC; border-radius: 12px; overflow: hidden">
<div style="padding: 10px 14px; background: #F3F4F1; font-size: 13px; font-weight: 700; color: #0B5C51">Bệnh nhân vào viện trong ca · ${v?.dAdmitCount}</div>
${v?.noDAdmits ? html`<p class="muted" style="padding: 10px 14px">Không có bệnh nhân vào viện.</p>` : null}
${(v?.dAdmits || []).map((a, $index) => html`
<div class="arow" style="display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; padding: 8px 14px; border-top: 1px solid #E6E9E5; font-size: 14px">
<span style="color: #56615C; min-width: 18px">${a?.n}.</span><strong>${a?.name}</strong><span class="muted">${a?.age} · ${a?.room} · vào ${a?.time}</span>
${a?.hasNote ? html`<span style="flex-basis: 100%; padding-left: 28px; color: #2B3531; font-size: 13px">${a?.note}</span>` : null}
</div>
`)}
</div>
<div style="border: 1px solid #DDE1DC; border-radius: 12px; overflow: hidden">
<div style="padding: 10px 14px; background: #F3F4F1; font-size: 13px; font-weight: 700; color: #0B5C51">Bệnh nhân chuyển khoa / chuyển viện · ${v?.dTransferCount}</div>
${v?.noDTransfers ? html`<p class="muted" style="padding: 10px 14px">Không có bệnh nhân chuyển.</p>` : null}
${(v?.dTransfers || []).map((a, $index) => html`
<div class="arow" style="display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; padding: 8px 14px; border-top: 1px solid #E6E9E5; font-size: 14px">
<span style="color: #56615C; min-width: 18px">${a?.n}.</span><strong>${a?.name}</strong><span class=${a?.tagCls}>${a?.kind}</span><span class="muted">${a?.age} · ${a?.room} · ${a?.time}</span>
${a?.hasNote ? html`<span style="flex-basis: 100%; padding-left: 28px; color: #2B3531; font-size: 13px">${a?.note}</span>` : null}
</div>
`)}
</div>
<p class="muted" style="margin-top: -6px">Bệnh nhân chuyển lấy từ mục Báo ra viện (chọn hình thức Chuyển khoa / Chuyển viện).</p>
<div style="border: 1px solid #E7C4AC; border-radius: 12px; overflow: hidden">
<div style="padding: 10px 14px; background: #FDF0E5; font-size: 13px; font-weight: 700; color: #7E3204">Diễn biến bất thường trong ca · ${v?.dEvCount}</div>
${v?.noDEvs ? html`<p class="muted" style="padding: 10px 14px">Không có diễn biến bất thường được ghi ở mục DHST/Diễn biến.</p>` : null}
${(v?.dEvs || []).map((b, $index) => html`
<div class="arow" style="padding: 8px 14px; border-top: 1px solid #F1E2D6; font-size: 14px">
<div><strong>${b?.n}. ${b?.name}</strong> <span class="muted">${b?.room}</span></div>
${(b?.notes || []).map((nt, $index) => html`<div style="font-size: 13.5px; padding-left: 18px; color: #2B3531">${nt?.text}</div>`)}
</div>
`)}
</div>
<fieldset style="border: 1px solid #DDE1DC; border-radius: 12px; padding: 4px 12px 10px; margin: 0; display: flex; flex-direction: column; gap: 0; min-width: 0">
<legend style="padding: 0 6px; font-size: 13px; font-weight: 700; color: #0B5C51">Ghi thêm diễn biến (nhập tay)</legend>
${(v?.dBlocks || []).map((b, $index) => html`
<div class="dvb" style="display: flex; flex-direction: column; gap: 6px; padding: 8px 0 10px; border-bottom: 1px dashed #C9D3CF">
<div style="display: flex; gap: 6px; align-items: center">
<span class="dvb-n" aria-hidden="true">${b?.n}</span>
<label class="sr" for=${b?.nameId}>Tên bệnh nhân ${b?.n}</label>
<input id=${b?.nameId} class="in in-c" type="text" autocomplete="off" style="flex: 1 1 auto; min-width: 0; font-weight: 600" value=${b?.name} onInput=${b?.onName} placeholder="Tên bệnh nhân" />
<label class="sr" for=${b?.roomId}>Phòng</label>
<input id=${b?.roomId} class="in in-c" type="text" autocomplete="off" style="flex: 0 0 72px; width: 72px" value=${b?.room} onInput=${b?.onRoom} placeholder="Phòng" />
<button type="button" class="ibtn ibtn-x" aria-label="Xóa bệnh nhân này" title="Xóa bệnh nhân này" onClick=${b?.remove}>×</button>
</div>
${b?.hasSugg ? html`
<div style="display: flex; flex-wrap: wrap; gap: 4px; padding-left: 30px">
${(b?.sugg || []).map((g, $index) => html`<button type="button" class="chip chip-s" onClick=${g?.pick}>${g?.label}</button>`)}
</div>
` : null}
${(b?.notes || []).map((nt, $index) => html`
<div style="display: flex; gap: 6px; align-items: flex-start; padding-left: 30px">
<label class="sr" for=${nt?.id}>Diễn biến ${nt?.n}</label>
<textarea id=${nt?.id} class="in in-c" rows="1" style="flex: 1 1 auto; min-width: 0; min-height: 40px; resize: vertical" value=${nt?.text} onInput=${nt?.onText} placeholder=${nt?.ph}></textarea>
<button type="button" class="ibtn" aria-label="Thêm diễn biến bên dưới" title="Thêm diễn biến bên dưới" onClick=${nt?.add}>+</button>
<button type="button" class="ibtn ibtn-x" aria-label="Xóa diễn biến" title="Xóa diễn biến" onClick=${nt?.remove}>×</button>
</div>
`)}
<button type="button" class="addpt" onClick=${b?.addBlock}>+ Thêm bệnh nhân</button>
</div>
`)}
</fieldset>
${v?.hasDerr ? html`<p class="err" role="alert">${v?.derr}</p>` : null}
<button type="button" class="btn" onClick=${v?.saveReport} style="align-self: flex-start">${v?.saveLabel}</button>
</section>

<section style="flex: 1 1 340px; min-width: 0; display: flex; flex-direction: column; gap: 12px">
<h2>Báo cáo đã lưu</h2>
${v?.noReports ? html`<div class="card" style="color: #56615C; font-size: 14px">Chưa có báo cáo nào trong phiên này.</div>` : null}
<div class="card" style="padding: 0; overflow: hidden">
${(v?.reports || []).map((r, $index) => html`
<div class="rrow" style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; padding: 10px 12px; border-top: 1px solid #E6E9E5">
<button type="button" class="rlink" onClick=${r?.view} style="flex: 1 1 160px; min-width: 0; text-align: left; border: 0; background: transparent; padding: 4px 0; min-height: 44px">
<span style="display: block; font-weight: 700; font-size: 15px; color: #17201D">${r?.title}</span>
<span style="display: block; font-size: 13px; color: #56615C">${r?.sub}</span>
</button>
<div style="display: flex; gap: 6px">
<button type="button" class="btn-o" onClick=${r?.pdf} aria-label="Tải PDF" title="Tải PDF"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align: -4px"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"></path></svg> ${r?.pdfLabel}</button>
<button type="button" class="btn-g" onClick=${r?.edit}>Sửa</button>
</div>
${r?.hasPdfErr ? html`<p class="err" style="flex-basis: 100%">${r?.pdfErr}</p>` : null}
</div>
`)}
</div>
</section>
</div>
` : null}

${v?.isDhst ? html`
<section style="display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px">
<div><h2>DHST & diễn biến theo phòng</h2><p class="muted">${v?.vDayLabel}</p></div>
<div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center">
<label class="sr" for="v-date">Ngày</label>
<input id="v-date" class="in in-c" type="date" style="width: auto" value=${v?.vdate} onInput=${v?.on?.vDate} />
<button type="button" class="btn-g" onClick=${v?.vToday}>Hôm nay</button>
<button type="button" class="btn" onClick=${v?.openRecAny}>+ Ghi DHST</button>
</div>
</div>
<div style="display: flex; flex-wrap: wrap; gap: 6px">
${(v?.vRoomChips || []).map((c, $index) => html`<button type="button" class=${c?.cls} onClick=${c?.pick}>${c?.label}</button>`)}
</div>
${v?.noVRooms ? html`<div class="card" style="text-align: center; color: #56615C; padding: 32px 16px">Không có bệnh nhân trong ngày này.</div>` : null}
${(v?.vRooms || []).map((g, $index) => html`
<section class="card" style="padding: 0; overflow: hidden">
<div style="padding: 10px 14px; background: #0F2F2A; color: #fff; font-weight: 700; display: flex; justify-content: space-between; align-items: center"><span>Phòng ${g?.room}</span><span style="font-weight: 400; font-size: 13px; color: #CFE2DD">${g?.count} bệnh nhân</span></div>
${(g?.patients || []).map((p, $index) => html`
<div style="border-top: 1px solid #E6E9E5; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px">
<div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px 10px">
<div style="min-width: 0"><strong>${p?.name}</strong> <span class="muted">${p?.age}</span>${p?.isOut ? html` <span class="tag tag-done">${p?.outTag}</span>` : null}</div>
<div style="display: flex; gap: 6px"><button type="button" class="btn-o" onClick=${p?.add}>+ Ghi</button><button type="button" class="btn-g" onClick=${p?.view}>Xem hồ sơ</button></div>
</div>
${p?.noRows ? html`<p class="muted">Chưa ghi DHST trong ngày.</p>` : null}
${p?.hasRows ? html`
<div class="vt">
<div class="vr vh"><div>Giờ</div><div>Mạch</div><div>HA</div><div>Nhiệt</div><div>SpO₂</div><div>NT</div></div>
${(p?.rows || []).map((r, $index) => html`
<div class="vr"><div style="font-weight: 600">${r?.time}</div><div class=${r?.m?.cls}>${r?.m?.text}</div><div class=${r?.ha?.cls}>${r?.ha?.text}</div><div class=${r?.t?.cls}>${r?.t?.text}</div><div class=${r?.o?.cls}>${r?.o?.text}</div><div class=${r?.r?.cls}>${r?.r?.text}</div></div>
${r?.hasNote ? html`<div class="vnote"><span class=${r?.tagCls}>${r?.tag}</span> ${r?.note}</div>` : null}
`)}
</div>
` : null}
</div>
`)}
</section>
`)}
</section>
` : null}

${v?.isLich ? html`
<section style="display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px">
<h2>Lịch tiêm khớp & điện cơ</h2>
<div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center">
${(v?.filters || []).map((c, $index) => html`<button type="button" class=${c?.cls} onClick=${c?.pick}>${c?.label}</button>`)}
<button type="button" class="btn" onClick=${v?.openOrderAny}>+ Thêm lịch</button>
</div>
</div>
${v?.noGroups ? html`<div class="card" style="text-align: center; color: #56615C; padding: 40px 20px">Chưa có lịch nào.</div>` : null}
${(v?.groups || []).map((g, $index) => html`
<div class=${g?.cls} style="display: flex; flex-direction: column; gap: 8px">
<h3 class="day-h" style="font-size: 14px; color: #3A4540">${g?.label}</h3>
${(g?.items || []).map((x, $index) => html`
<div class=${x?.rowCls}>
<div style="font-size: 20px; font-weight: 700; min-width: 64px">${x?.time}</div>
<div style="flex: 1 1 220px; min-width: 0; display: flex; flex-direction: column; gap: 2px">
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px"><span class=${x?.tagCls}>${x?.typeLabel}</span><strong>${x?.patient}</strong>${x?.done ? html`<span class="tag tag-done">Đã thực hiện</span>` : null}</div>
<div style="font-size: 14px; color: #2B3531">${x?.site} · ${x?.who}</div>
${x?.hasNote ? html`<div class="muted">${x?.note}</div>` : null}
</div>
<div style="display: flex; flex-wrap: wrap; gap: 8px">
<button type="button" class="btn-o" onClick=${x?.toggle}>${x?.toggleLabel}</button>
<button type="button" class="btn-g" onClick=${x?.remove}>Xóa</button>
</div>
</div>
`)}
</div>
`)}
</section>
` : null}

</main>

<button type="button" class="fab" aria-label="Nhập viện" title="Nhập viện" onClick=${v?.openAdmit}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg></button>

${v?.modalAdmit ? html`
<div class="overlay">
<button type="button" class="scrim" aria-label="Đóng" onClick=${v?.closeModal}></button>
<form class="dialog" role="dialog" aria-modal="true" aria-labelledby="adm-h" onSubmit=${v?.submitPt}>
<div style="display: flex; justify-content: space-between; align-items: center; gap: 10px">
<h2 id="adm-h">${v?.admTitle}</h2>
<button type="button" class="btn-g" aria-label="Đóng" onClick=${v?.closeModal} style="padding: 0 12px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
</div>
<div style="display: flex; align-items: center; gap: 10px; background: #E4F0EC; color: #0B4F45; border-radius: 10px; padding: 10px 12px; font-size: 14px">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
${v?.admNew ? html`<span>Giờ nhập: <strong>${v?.nowShort}</strong></span>` : null}
${v?.admEdit ? html`<label for="pt-at" style="white-space: nowrap">Giờ nhập</label><input id="pt-at" class="in in-c" type="datetime-local" style="flex: 1; min-width: 0; background: #fff" value=${v?.editAt} onInput=${v?.on?.editAt} />` : null}
</div>
<div class="g2" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">
<div class="f" style="grid-column: 1 / -1">
<label class="lbl" for="pt-name">Họ tên bệnh nhân *</label>
<input id="pt-name" class="in" type="text" autocomplete="off" value=${v?.form?.name} onInput=${v?.on?.name} placeholder="VD: Nguyễn Văn A" />
</div>
<div class="f"><label class="lbl" for="pt-age">Tuổi</label><input id="pt-age" class="in" type="text" inputmode="numeric" value=${v?.form?.age} onInput=${v?.on?.age} /></div>
<div class="f"><label class="lbl" for="pt-room">Phòng *</label><input id="pt-room" class="in" type="text" autocomplete="off" value=${v?.form?.room} onInput=${v?.on?.room} placeholder="VD: P.301" /></div>
</div>
<fieldset style="border: 1px solid #DDE1DC; border-radius: 12px; padding: 10px 14px 14px; margin: 0">
<legend style="padding: 0 6px; font-size: 13px; font-weight: 700; color: #0B5C51">Dấu hiệu sinh tồn</legend>
<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 10px">
<div class="f"><label class="lbl" for="pt-m">Mạch <span class="unit">l/p</span></label><input id="pt-m" class="in" type="text" inputmode="numeric" value=${v?.form?.pulse} onInput=${v?.on?.pulse} /></div>
<div class="f"><label class="lbl" for="pt-bp">HA <span class="unit">mmHg</span></label><input id="pt-bp" class="in" type="text" inputmode="numeric" value=${v?.form?.bp} onInput=${v?.on?.bp} placeholder="120/80" /></div>
<div class="f"><label class="lbl" for="pt-t">Nhiệt <span class="unit">°C</span></label><input id="pt-t" class="in" type="text" inputmode="decimal" value=${v?.form?.temp} onInput=${v?.on?.temp} /></div>
<div class="f"><label class="lbl" for="pt-o">SpO₂ <span class="unit">%</span></label><input id="pt-o" class="in" type="text" inputmode="numeric" value=${v?.form?.spo2} onInput=${v?.on?.spo2} /></div>
<div class="f"><label class="lbl" for="pt-r">Nhịp thở <span class="unit">l/p</span></label><input id="pt-r" class="in" type="text" inputmode="numeric" value=${v?.form?.rr} onInput=${v?.on?.rr} /></div>
</div>
</fieldset>
<div class="f">
<label class="lbl" for="pt-note">Ghi chú</label>
<textarea id="pt-note" class="in" value=${v?.form?.note} onInput=${v?.on?.note} placeholder="Lý do vào viện, chẩn đoán sơ bộ, lưu ý…"></textarea>
</div>
${v?.hasErr ? html`<p class="err" role="alert">${v?.err}</p>` : null}
<div style="display: flex; gap: 8px; justify-content: flex-end">
<button type="button" class="btn-g" onClick=${v?.closeModal}>Hủy</button>
<button type="submit" class="btn">${v?.admSave}</button>
</div>
</form>
</div>
` : null}

${v?.modalOrder ? html`
<div class="overlay">
<button type="button" class="scrim" aria-label="Đóng" onClick=${v?.closeModal}></button>
<form class="dialog" role="dialog" aria-modal="true" aria-labelledby="ord-h" onSubmit=${v?.submitSched}>
<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px">
<div><h2 id="ord-h">Lên chỉ định</h2>${v?.orderLocked ? html`<p class="muted">${v?.orderWho}</p>` : null}</div>
<button type="button" class="btn-g" aria-label="Đóng" onClick=${v?.closeModal} style="padding: 0 12px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
</div>
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #EEF0ED; padding: 4px; border-radius: 12px">
${(v?.typeSeg || []).map((t, $index) => html`<button type="button" class=${t?.cls} onClick=${t?.pick}>${t?.label}</button>`)}
</div>
${v?.orderPick ? html`
<div class="f">
<label class="lbl" for="s-pt">Bệnh nhân *</label>
${v?.pk1?.sel ? html`<div class="pksel"><span class="room">${v?.pk1?.room}</span><div style="flex: 1; min-width: 0"><strong>${v?.pk1?.name}</strong><div class="muted">${v?.pk1?.info}</div></div><button type="button" class="btn-g" onClick=${v?.pk1?.clear}>Đổi</button></div>` : null}
${v?.pk1?.search ? html`
<input id="s-pt" class="in" type="search" autocomplete="off" value=${v?.pk1?.q} onInput=${v?.pk1?.onQ} placeholder="Gõ tên hoặc số phòng…" />
${v?.pk1?.hasSugg ? html`<div class="sugg">${(v?.pk1?.sugg || []).map((g, $index) => html`<button type="button" class="sg" onClick=${g?.pick}><span class="room">${g?.room}</span><span style="flex: 1; min-width: 0; text-align: left"><strong>${g?.name}</strong> <span class="muted">${g?.age}</span></span></button>`)}</div>` : null}
${v?.pk1?.noMatch ? html`<p class="muted">Không tìm thấy bệnh nhân đang điều trị phù hợp.</p>` : null}
` : null}
</div>
` : null}
<div class="f">
<label class="lbl" for="s-site">${v?.siteLabel} *</label>
<div style="display: flex; flex-wrap: wrap; gap: 6px">
${(v?.siteChips || []).map((c, $index) => html`<button type="button" class=${c?.cls} onClick=${c?.pick}>${c?.label}</button>`)}
</div>
<input id="s-site" class="in" type="text" value=${v?.sform?.site} onInput=${v?.on?.sSite} placeholder="Hoặc nhập vị trí khác" />
</div>
<div class="g2" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">
<div class="f"><label class="lbl" for="s-date">Ngày</label><input id="s-date" class="in" type="date" value=${v?.sform?.date} onInput=${v?.on?.sDate} /></div>
<div class="f"><label class="lbl" for="s-time">Giờ</label><input id="s-time" class="in" type="time" value=${v?.sform?.time} onInput=${v?.on?.sTime} /></div>
<div class="f"><label class="lbl" for="s-who">Người thực hiện</label><input id="s-who" class="in" type="text" value=${v?.sform?.who} onInput=${v?.on?.sWho} /></div>
<div class="f"><label class="lbl" for="s-note">Ghi chú</label><input id="s-note" class="in" type="text" value=${v?.sform?.note} onInput=${v?.on?.sNote} /></div>
</div>
${v?.hasSerr ? html`<p class="err" role="alert">${v?.serr}</p>` : null}
<div style="display: flex; gap: 8px; justify-content: flex-end">
<button type="button" class="btn-g" onClick=${v?.closeModal}>Hủy</button>
<button type="submit" class="btn">Lưu chỉ định</button>
</div>
</form>
</div>
` : null}

${v?.modalRec ? html`
<div class="overlay">
<button type="button" class="scrim" aria-label="Đóng" onClick=${v?.cancelRec}></button>
<form class="dialog" role="dialog" aria-modal="true" aria-labelledby="rec-h" onSubmit=${v?.submitRec}>
<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px">
<div><h2 id="rec-h">Ghi DHST / diễn biến</h2><p class="muted">${v?.recWho}</p></div>
<button type="button" class="btn-g" aria-label="Đóng" onClick=${v?.cancelRec} style="padding: 0 12px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
</div>
<div style="display: flex; align-items: center; gap: 10px; background: #E4F0EC; color: #0B4F45; border-radius: 10px; padding: 8px 12px; font-size: 14px">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
<span>Giờ ghi: <strong>${v?.nowShort}</strong></span>
</div>
${v?.recPick ? html`
<div class="f">
<label class="lbl" for="r-pt">Bệnh nhân *</label>
${v?.pk2?.sel ? html`<div class="pksel"><span class="room">${v?.pk2?.room}</span><div style="flex: 1; min-width: 0"><strong>${v?.pk2?.name}</strong><div class="muted">${v?.pk2?.info}</div></div><button type="button" class="btn-g" onClick=${v?.pk2?.clear}>Đổi</button></div>` : null}
${v?.pk2?.search ? html`
<input id="r-pt" class="in" type="search" autocomplete="off" value=${v?.pk2?.q} onInput=${v?.pk2?.onQ} placeholder="Gõ tên hoặc số phòng…" />
${v?.pk2?.hasSugg ? html`<div class="sugg">${(v?.pk2?.sugg || []).map((g, $index) => html`<button type="button" class="sg" onClick=${g?.pick}><span class="room">${g?.room}</span><span style="flex: 1; min-width: 0; text-align: left"><strong>${g?.name}</strong> <span class="muted">${g?.age}</span></span></button>`)}</div>` : null}
${v?.pk2?.noMatch ? html`<p class="muted">Không tìm thấy bệnh nhân đang điều trị phù hợp.</p>` : null}
` : null}
</div>
` : null}
<fieldset style="border: 1px solid #DDE1DC; border-radius: 12px; padding: 8px 12px 12px; margin: 0">
<legend style="padding: 0 6px; font-size: 13px; font-weight: 700; color: #0B5C51">Dấu hiệu sinh tồn</legend>
<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px">
<div class="f"><label class="lbl" for="r-m">Mạch</label><input id="r-m" class="in in-c" type="text" inputmode="numeric" value=${v?.rform?.pulse} onInput=${v?.on3?.pulse} /></div>
<div class="f"><label class="lbl" for="r-bp">HA</label><input id="r-bp" class="in in-c" type="text" inputmode="numeric" value=${v?.rform?.bp} onInput=${v?.on3?.bp} placeholder="120/80" /></div>
<div class="f"><label class="lbl" for="r-t">Nhiệt °C</label><input id="r-t" class="in in-c" type="text" inputmode="decimal" value=${v?.rform?.temp} onInput=${v?.on3?.temp} /></div>
<div class="f"><label class="lbl" for="r-o">SpO₂ %</label><input id="r-o" class="in in-c" type="text" inputmode="numeric" value=${v?.rform?.spo2} onInput=${v?.on3?.spo2} /></div>
<div class="f"><label class="lbl" for="r-r">Nhịp thở</label><input id="r-r" class="in in-c" type="text" inputmode="numeric" value=${v?.rform?.rr} onInput=${v?.on3?.rr} /></div>
</div>
</fieldset>
<div class="f">
<label class="lbl" for="r-note">Diễn biến</label>
<textarea id="r-note" class="in" style="min-height: 64px" value=${v?.rform?.note} onInput=${v?.on3?.note} placeholder="Để trống nếu chỉ ghi DHST thường quy"></textarea>
</div>
<label class="chk"><input type="checkbox" checked=${v?.rform?.abn} onChange=${v?.on3?.abn} /><span>Diễn biến bất thường – <strong>đưa vào báo cáo trực</strong></span></label>
${v?.recTxOpen ? html`
<div class="f"><label class="lbl" for="r-tx">Xử trí</label><textarea id="r-tx" class="in" style="min-height: 56px" value=${v?.rform?.tx} onInput=${v?.on3?.tx} placeholder="Thuốc, y lệnh, theo dõi…"></textarea></div>
` : null}
${v?.recTxClosed ? html`<button type="button" class="addpt" style="margin-left: 0" onClick=${v?.on3?.showTx}>+ Thêm xử trí</button>` : null}
${v?.hasRerr ? html`<p class="err" role="alert">${v?.rerr}</p>` : null}
<div style="display: flex; gap: 8px; justify-content: flex-end">
<button type="button" class="btn-g" onClick=${v?.cancelRec}>Hủy</button>
<button type="submit" class="btn">Lưu</button>
</div>
</form>
</div>
` : null}

${v?.modalPt ? html`
<div class="overlay">
<button type="button" class="scrim" aria-label="Đóng" onClick=${v?.closeModal}></button>
<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="pv-h" style="max-width: 640px">
<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px">
<div style="display: flex; gap: 10px; align-items: flex-start; min-width: 0">
<span class="room">${v?.pv?.room}</span>
<div style="min-width: 0"><h2 id="pv-h">${v?.pv?.name}</h2><p class="muted">${v?.pv?.info}</p></div>
</div>
<button type="button" class="btn-g" aria-label="Đóng" onClick=${v?.closeModal} style="padding: 0 12px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
</div>
${v?.pv?.canAdd ? html`<button type="button" class="btn" onClick=${v?.pv?.add} style="align-self: flex-start">+ Ghi DHST / diễn biến</button>` : null}
<div>
${(v?.pv?.items || []).map((it, $index) => html`
<div class="tl">
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px"><strong style="font-size: 14px">${it?.when}</strong><span class=${it?.tagCls}>${it?.tag}</span></div>
${it?.hasVit ? html`<div style="display: flex; flex-wrap: wrap; gap: 6px">${(it?.vit || []).map((v, $index) => html`<span class=${v?.cls}><b>${v?.label}</b>${v?.text}</span>`)}</div>` : null}
${it?.hasNote ? html`<p style="margin: 0; font-size: 14px; color: #17201D">${it?.note}</p>` : null}
${(it?.txs || []).map((x, $index) => html`<div class="tx"><b>Xử trí ${x?.when}:</b> ${x?.text}</div>`)}
${it?.txOpen ? html`
<div style="display: flex; flex-direction: column; gap: 6px">
<label class="sr" for=${it?.txId}>Nội dung xử trí</label>
<textarea id=${it?.txId} class="in in-c" style="min-height: 56px" value=${v?.txText} onInput=${v?.on?.txText} placeholder="Thuốc, y lệnh, theo dõi…"></textarea>
<div style="display: flex; gap: 6px; justify-content: flex-end"><button type="button" class="btn-g" onClick=${v?.cancelTx}>Hủy</button><button type="button" class="btn" onClick=${it?.saveTx}>Lưu xử trí</button></div>
</div>
` : null}
${it?.txBtn ? html`<button type="button" class="addpt" style="margin-left: 0" onClick=${it?.openTx}>+ Thêm xử trí</button>` : null}
</div>
`)}
</div>
</div>
</div>
` : null}

${v?.modalView ? html`
<div class="overlay">
<button type="button" class="scrim" aria-label="Đóng" onClick=${v?.closeModal}></button>
<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="rv-h" style="max-width: 680px">
<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px">
<div><h2 id="rv-h">${v?.rv?.title}</h2><p class="muted">${v?.rv?.window}</p><p style="margin: 4px 0 0; font-size: 14px">${v?.rv?.people}</p></div>
<button type="button" class="btn-g" aria-label="Đóng" onClick=${v?.closeModal} style="padding: 0 12px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
</div>
<div class="dstats" style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px">
${(v?.rv?.stats || []).map((s, $index) => html`
<div class=${s?.cls} style="padding: 8px 4px; text-align: center"><div class="ds-l" style="font-size: 11px; font-weight: 600">${s?.label}</div><div class="ds-n" style="font-size: 20px; font-weight: 700; line-height: 1.2">${s?.n}</div></div>
`)}
</div>
<div>
<h3 style="font-size: 14px; color: #0B5C51; margin-bottom: 6px">Bệnh nhân vào viện · ${v?.rv?.admitCount}</h3>
${v?.rv?.noAdmits ? html`<p class="muted">Không có.</p>` : null}
${(v?.rv?.admits || []).map((a, $index) => html`
<div style="padding: 6px 0; border-top: 1px solid #E6E9E5; font-size: 14px"><strong>${a?.n}. ${a?.name}</strong> <span class="muted">${a?.age} · ${a?.room} · vào ${a?.time}</span>${a?.hasNote ? html`<div style="font-size: 13px; color: #2B3531; padding-left: 18px">${a?.note}</div>` : null}</div>
`)}
</div>
<div>
<h3 style="font-size: 14px; color: #0B5C51; margin-bottom: 6px">Bệnh nhân chuyển · ${v?.rv?.transferCount}</h3>
${v?.rv?.noTransfers ? html`<p class="muted">Không có.</p>` : null}
${(v?.rv?.transfers || []).map((a, $index) => html`
<div style="padding: 6px 0; border-top: 1px solid #E6E9E5; font-size: 14px"><strong>${a?.n}. ${a?.name}</strong> <span class=${a?.tagCls}>${a?.kind}</span> <span class="muted">${a?.age} · ${a?.room} · ${a?.time}</span>${a?.hasNote ? html`<div style="font-size: 13px; color: #2B3531; padding-left: 18px">${a?.note}</div>` : null}</div>
`)}
</div>
<div>
<h3 style="font-size: 14px; color: #0B5C51; margin-bottom: 6px">Diễn biến</h3>
${v?.rv?.noBlocks ? html`<p class="muted">Không có diễn biến đặc biệt.</p>` : null}
${(v?.rv?.blocks || []).map((b, $index) => html`
<div style="padding: 8px 0; border-top: 1px solid #E6E9E5">
<div style="font-weight: 700; font-size: 14px">${b?.n}. ${b?.name} <span class="muted" style="font-weight: 400">${b?.room}</span></div>
${(b?.notes || []).map((nt, $index) => html`<div style="font-size: 14px; padding-left: 18px; color: #2B3531">• ${nt?.text}</div>`)}
</div>
`)}
</div>
<div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end">
<button type="button" class="btn-g" onClick=${v?.rv?.copy}>${v?.rv?.copyLabel}</button>
<button type="button" class="btn-o" onClick=${v?.rv?.edit}>Sửa</button>
<button type="button" class="btn" onClick=${v?.rv?.pdf}>${v?.rv?.pdfLabel}</button>
</div>
</div>
</div>
` : null}

${v?.modalOut ? html`
<div class="overlay">
<button type="button" class="scrim" aria-label="Đóng" onClick=${v?.closeModal}></button>
<form class="dialog" role="dialog" aria-modal="true" aria-labelledby="out-h" onSubmit=${v?.submitOut}>
<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px">
<div><h2 id="out-h">Báo ra viện</h2><p class="muted">${v?.outWho}</p></div>
<button type="button" class="btn-g" aria-label="Đóng" onClick=${v?.closeModal} style="padding: 0 12px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
</div>
<div class="f">
<span class="lbl">Hình thức</span>
<div style="display: flex; flex-wrap: wrap; gap: 6px">
${(v?.outKinds || []).map((c, $index) => html`<button type="button" class=${c?.cls} onClick=${c?.pick}>${c?.label}</button>`)}
</div>
</div>
<div class="f">
<label class="lbl" for="o-time">Giờ ra viện *</label>
<div style="display: flex; flex-wrap: wrap; gap: 8px">
<input id="o-time" class="in" type="datetime-local" style="flex: 1 1 220px; width: auto" value=${v?.oform?.time} onInput=${v?.on2?.oTime} />
<button type="button" class="btn-g" onClick=${v?.on2?.oNow}>Bây giờ</button>
</div>
<p class="muted">Chọn giờ sau thời điểm hiện tại nếu báo trước — bệnh nhân vẫn tính giường đến giờ đó.</p>
</div>
<div class="f">
<label class="lbl" for="o-note">Ghi chú</label>
<textarea id="o-note" class="in" value=${v?.oform?.note} onInput=${v?.on2?.oNote} placeholder=${v?.outNotePh}></textarea>
</div>
${v?.hasOerr ? html`<p class="err" role="alert">${v?.oerr}</p>` : null}
<div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end">
${v?.outReported ? html`<button type="button" class="btn-g" onClick=${v?.cancelReport} style="margin-right: auto">Hủy báo ra viện</button>` : null}
<button type="button" class="btn-g" onClick=${v?.closeModal}>Đóng</button>
<button type="submit" class="btn-d">Lưu báo ra viện</button>
</div>
</form>
</div>
` : null}

</div>
`;
}


var pad = function (n) { return String(n).padStart(2, '0'); };
var WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
var WDL = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
var HOUR = 3600000, DAY = 86400000;
var TYPE = { tiem: 'Tiêm khớp', dien: 'Điện cơ' };
var SITES = {
  tiem: ['Khớp gối P', 'Khớp gối T', 'Khớp vai P', 'Khớp vai T', 'Khớp cổ tay', 'Khớp cổ chân'],
  dien: ['Chi trên 2 bên', 'Chi dưới 2 bên', 'Chi trên P', 'Chi trên T', 'Chi dưới P', 'Chi dưới T']
};
function hm(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function dm(t) { var d = new Date(t); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }
function dmy(t) { return dm(t) + '/' + new Date(t).getFullYear(); }
function isoDay(t) { var d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function fromIso(s) { var a = String(s).split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]).getTime(); }
function num(s) { var x = parseFloat(String(s == null ? '' : s).replace(',', '.')); return isNaN(x) ? null : x; }
function ageText(p) { return String(p.age || '').trim() ? String(p.age).trim() + ' tuổi' : 'Chưa rõ tuổi'; }
function vitals(p) {
  var m = num(p.pulse), t = num(p.temp), o = num(p.spo2), r = num(p.rr);
  var bp = String(p.bp || '').split('/'); var sy = num(bp[0]), di = num(bp[1]);
  function row(label, val, unit, bad) {
    var v = String(val || '').trim();
    return { label: label, has: v !== '', raw: v || '—', text: v ? v + ' ' + unit : '—', bad: !!(v && bad) };
  }
  return [
    row('M', p.pulse, 'l/p', m != null && (m > 100 || m < 50)),
    row('HA', p.bp, 'mmHg', (sy != null && (sy >= 160 || sy < 90)) || (di != null && (di >= 100 || di < 50))),
    row('T', p.temp, '°C', t != null && (t >= 38 || t < 36)),
    row('SpO₂', p.spo2, '%', o != null && o < 94),
    row('NT', p.rr, 'l/p', r != null && (r > 24 || r < 12))
  ];
}
function isBad(p) { return vitals(p).some(function (v) { return v.bad; }); }
function vitalLine(p) { return vitals(p).filter(function (v) { return v.has; }).map(function (v) { return v.label + ' ' + v.text + (v.bad ? ' (!)' : ''); }).join(', '); }
function badLine(p) { return vitals(p).filter(function (v) { return v.bad; }).map(function (v) { return v.label + ' ' + v.text; }).join(', '); }
function dayDiff(iso, today) { return Math.round((fromIso(iso) - fromIso(today)) / DAY); }
function dayLabel(iso, today) {
  var t = fromIso(iso), base = WD[new Date(t).getDay()] + ' ' + dm(t), d = dayDiff(iso, today);
  if (d === 0) return 'Hôm nay · ' + base;
  if (d === 1) return 'Ngày mai · ' + base;
  if (d < 0) return 'Quá hạn · ' + base;
  return base;
}
function byRoom(a, b) { return String(a.room).localeCompare(String(b.room), 'vi', { numeric: true }); }
function isIn(p) { return p.status === 'in' || (p.outAt != null && p.outAt > Date.now()); }
function isOut(p) { return !isIn(p); }
function dtLocal(t) { return isoDay(t) + 'T' + hm(t); }
function byAdmitDesc(a, b) { return b.admitAt - a.admitAt; }
function bySlot(a, b) { return (a.date + ' ' + a.time).localeCompare(b.date + ' ' + b.time); }
var KIND = { ra: 'Ra viện', ck: 'Chuyển khoa', cv: 'Chuyển viện' };
var EMPTY_FORM = { name: '', age: '', room: '', pulse: '', bp: '', temp: '', spo2: '', rr: '', note: '' };

var VKEYS = ['pulse', 'bp', 'temp', 'spo2', 'rr'];
function hasVit(r) { return VKEYS.some(function (k) { return String(r[k] || '').trim() !== ''; }); }
function demoRecs(pts, now) {
  var recs = [], id = 1, today0 = fromIso(isoDay(now));
  pts.forEach(function (p) {
    if (p.status !== 'in') return;
    var bp = String(p.bp).split('/'), b = { m: num(p.pulse) || 80, sy: num(bp[0]) || 125, di: num(bp[1]) || 78, t: num(p.temp) || 36.8, o: num(p.spo2) || 98, r: num(p.rr) || 18 };
    var fever = b.t >= 38, idx = 0, last = null;
    for (var dd = 3; dd >= 0; dd--) {
      var d0 = today0 - dd * DAY;
      [7, 15].forEach(function (h) {
        var at = d0 + h * HOUR + (p.id % 4) * 5 * 60000;
        if (at <= p.admitAt + HOUR || at > now) return;
        var j = ((p.id * 7 + idx * 3) % 5) - 2;
        var t = fever ? Math.max(36.8, b.t - idx * 0.3) : b.t + j * 0.1;
        var rec = { id: id++, pid: p.id, at: at, pulse: String(Math.round(fever ? Math.max(84, b.m - idx * 4) : b.m + j * 2)), bp: (b.sy + j * 3) + '/' + (b.di + j * 2), temp: t.toFixed(1), spo2: String(Math.min(99, b.o + (j > 0 ? 1 : 0))), rr: String(b.r + (j > 1 ? 1 : 0)), note: '', abn: false, tx: [] };
        recs.push(rec); last = rec; idx++;
      });
    }
    var back = (3 + p.id % 6) * HOUR + (p.id % 3) * 17 * 60000;
    if (fever && now - back > p.admitAt + HOUR) {
      var at2 = now - back;
      var ev = { id: id++, pid: p.id, at: at2, pulse: '108', bp: '150/90', temp: '38.6', spo2: '96', rr: '22', note: 'Sốt 38,6°C kèm rét run, đau tăng khớp cổ tay P.', abn: true, tx: [{ id: id++, at: at2 + 10 * 60000, text: 'Paracetamol 1g truyền TM; chườm ấm; theo dõi nhiệt độ mỗi 2 giờ.' }] };
      recs.push(ev); if (!last || last.at < at2) last = ev;
    }
    if (last) VKEYS.forEach(function (k) { p[k] = last[k]; });
  });
  return recs;
}
function demoPatients(now) {
  var ins = [2, 1, 3, 1, 2, 0, 2, 3, 1, 2, 1, 2, 3, 2];
  var los = [4, 6, 3, 7, 5, 8, 4, 5, 6, 3];
  var ages = [67, 54, 72, 45, 61, 38, 70, 58, 49, 76, 63, 52, 81, 44, 59, 66, 71, 57, 48, 69, 62, 55, 74, 50, 65, 60, 47];
  var rooms = ['P.301', 'P.302', 'P.303', 'P.304', 'P.305', 'P.306'];
  var vs = [
    { pulse: '82', bp: '130/80', temp: '36.8', spo2: '98', rr: '18' },
    { pulse: '104', bp: '165/95', temp: '38.2', spo2: '97', rr: '20' },
    { pulse: '76', bp: '120/70', temp: '36.6', spo2: '98', rr: '18' },
    { pulse: '88', bp: '140/85', temp: '37.0', spo2: '96', rr: '19' }
  ];
  var start = fromIso(isoDay(now)), out = [], id = 1;
  for (var d = 0; d < ins.length; d++) {
    var dayStart = start - (ins.length - 1 - d) * DAY;
    for (var j = 0; j < ins[d]; j++) {
      var at = dayStart + (8 + (j * 3 + d) % 10) * HOUR;
      if (at > now) at = now - (j + 1) * 1.5 * HOUR;
      var outAt = at + los[id % los.length] * DAY;
      var p = Object.assign({ id: id, name: 'BN mẫu ' + pad(id), age: String(ages[id % ages.length]), room: rooms[id % rooms.length], note: '', admitAt: at, av: Object.assign({}, vs[id % vs.length]) }, vs[id % vs.length]);
      if (outAt < now) { p.status = 'out'; p.outAt = outAt; } else { p.status = 'in'; }
      out.push(p); id++;
    }
  }
  return out;
}

class Component extends DCLogic {
  constructor(props) {
    super(props);
    var now = Date.now(), today = isoDay(now), tomorrow = isoDay(now + DAY);
    var I = props.init || {};
    var pts = I.patients || [], recs = I.recs || [];
    var act = pts.filter(function (p) { return isIn(p); });
    var a1 = act[0] ? act[0].id : null, a2 = act[1] ? act[1].id : a1;
    this.state = {
      tab: 'dash', now: now, q: '', err: '', confirmId: null, copied: '', showOut: false,
      modal: null, orderLocked: false, beds: I.beds != null ? I.beds : null, oform: null, oerr: '',
      form: Object.assign({}, EMPTY_FORM),
      patients: pts, nextId: pts.length + 1,
      sform: { type: 'tiem', patientId: null, site: '', date: today, time: '08:00', who: '', note: '' },
      serr: '', filter: 'all',
      scheds: I.scheds || [],
      nextSid: 3,
      duty: { date: isoDay(now - 7 * HOUR), doctor: '', nurse: '' },
      recs: recs, nextRid: recs.length + 100, rform: null, rerr: '', ptId: null, txFor: null, txText: '', vdate: today, vroom: 'all',
      dvb: [{ id: 1, name: '', room: '', notes: [{ id: 2, text: '' }] }], nextDid: 3, reports: (I.reports || []).slice().sort(function (a, b) { return b.savedAt - a.savedAt; }), derr: '', pdf: {}, editingId: null, viewId: null
    };
  }
  componentDidMount() { var self = this; this.timer = setInterval(function () { self.setState({ now: Date.now() }); }, 30000); SYNC.attach(this); this.sceneTimer = setInterval(function () { self.setState(function (st) { return { scene: ((st.scene || 0) + 1) % 4 }; }); }, 6000); }
  componentDidUpdate() { SYNC.push(this.state); }
  componentWillUnmount() { clearInterval(this.timer); clearInterval(this.sceneTimer); clearTimeout(this.ct); }

  bedsN() { var b = num(this.state.beds != null ? this.state.beds : this.props.beds); return b && b > 0 ? Math.round(b) : 30; }
  setIn(group, key) {
    var self = this;
    return function (e) {
      var v = e && e.target ? e.target.value : e;
      self.setState(function (st) { var o = {}; o[group] = Object.assign({}, st[group]); o[group][key] = v; o.err = ''; o.serr = ''; o.derr = ''; return o; });
    };
  }
  pById(id) { return this.state.patients.find(function (p) { return p.id === id; }); }
  snapshot() {
    var s = this.state, now = Math.max(s.now, Date.now() - 60000), today = isoDay(now);
    var active = s.patients.filter(function (p) { return isIn(p); }).sort(byRoom);
    return {
      now: now, today: today, active: active,
      newIn: active.filter(function (p) { return now - p.admitAt < DAY; }),
      out: s.patients.filter(function (p) { return isOut(p) && now - p.outAt < DAY; }),
      bad: active.filter(isBad),
      todayP: s.scheds.filter(function (x) { return x.date === today; }).sort(bySlot)
    };
  }
  openOrder(id) {
    var today = isoDay(Date.now());
    this.setState(function (st) {
      return { modal: 'order', orderLocked: id != null, serr: '', confirmId: null,
        sform: Object.assign({}, st.sform, { patientId: id != null ? id : st.sform.patientId, site: '', note: '', date: st.sform.date < today ? today : st.sform.date }) };
    });
  }
  openEditPt(pid) {
    var p = this.pById(pid); if (!p) return;
    var f = { name: p.name, age: p.age || '', room: p.room, note: p.note || '' }, av = p.av || {};
    VKEYS.forEach(function (k) { f[k] = av[k] || ''; });
    this.setState({ modal: 'admit', editPid: pid, editAt: dtLocal(p.admitAt), form: f, err: '' });
  }
  addPatient(e) {
    if (e && e.preventDefault) e.preventDefault();
    var f = this.state.form;
    if (this.state.editPid) {
      var pid = this.state.editPid, p0 = this.pById(pid);
      if (!f.name.trim() || !f.room.trim()) { this.setState({ err: 'Cần nhập Họ tên và Phòng.' }); return; }
      var at = new Date(this.state.editAt).getTime();
      if (!this.state.editAt || isNaN(at)) { this.setState({ err: 'Giờ nhập không hợp lệ.' }); return; }
      if (at > Date.now()) { this.setState({ err: 'Giờ nhập không được sau thời điểm hiện tại.' }); return; }
      if (p0 && p0.status === 'out' && p0.outAt && at >= p0.outAt) { this.setState({ err: 'Giờ nhập phải trước giờ ra viện.' }); return; }
      var hasRecs = this.state.recs.some(function (r) { return r.pid === pid && hasVit(r); });
      this.setState(function (st) {
        return { modal: null, editPid: null, err: '', form: Object.assign({}, EMPTY_FORM),
          patients: st.patients.map(function (p) {
            if (p.id !== pid) return p;
            var u = Object.assign({}, p, { name: f.name.trim(), age: String(f.age).trim(), room: f.room.trim(), note: String(f.note).trim(), admitAt: at, av: {} });
            VKEYS.forEach(function (k) { u.av[k] = String(f[k] || '').trim(); if (!hasRecs) u[k] = u.av[k]; });
            return u;
          }) };
      });
      return;
    }
    if (!f.name.trim() || !f.room.trim()) { this.setState({ err: 'Cần nhập Họ tên và Phòng.' }); return; }
    var t = Date.now();
    this.setState(function (st) {
      var p = Object.assign({}, f, { name: f.name.trim(), age: f.age.trim(), room: f.room.trim(), note: f.note.trim(), id: uid(), admitAt: t, status: 'in' });
      p.av = {}; VKEYS.forEach(function (kk) { p.av[kk] = String(f[kk] || '').trim(); });
      return { patients: st.patients.concat([p]), nextId: uid() + 1, form: Object.assign({}, EMPTY_FORM), err: '', now: t, modal: null };
    });
  }
  openPt(pid) { this.setState({ modal: 'pt', ptId: pid, txFor: null, txText: '' }); }
  openRec(pid, back) {
    this.setState({ modal: 'rec', rerr: '', now: Date.now(),
      rform: { pid: pid, locked: pid != null, back: back || null, pulse: '', bp: '', temp: '', spo2: '', rr: '', note: '', abn: false, abnTouched: false, tx: '', showTx: false } });
  }
  cancelRec() { var f = this.state.rform; this.setState(f && f.back === 'pt' ? { modal: 'pt', ptId: f.pid, rerr: '' } : { modal: null, rerr: '' }); }
  saveRec(e) {
    if (e && e.preventDefault) e.preventDefault();
    var f = this.state.rform;
    if (!f || !f.pid) { this.setState({ rerr: 'Chọn bệnh nhân.' }); return; }
    var note = String(f.note || '').trim(), tx = String(f.tx || '').trim();
    if (!hasVit(f) && !note) { this.setState({ rerr: 'Nhập ít nhất một chỉ số DHST hoặc nội dung diễn biến.' }); return; }
    var t = Date.now();
    this.setState(function (st) {
      var id = uid(), rec = { id: id, pid: f.pid, at: t, note: note, abn: !!f.abn, tx: tx ? [{ id: id + 1, at: t, text: tx }] : [] };
      VKEYS.forEach(function (k) { rec[k] = String(f[k] || '').trim(); });
      return {
        recs: st.recs.concat([rec]), nextRid: id + 2, rerr: '', now: t,
        patients: st.patients.map(function (p) {
          if (p.id !== f.pid) return p;
          var u = Object.assign({}, p); VKEYS.forEach(function (k) { if (rec[k]) u[k] = rec[k]; }); return u;
        }),
        modal: f.back === 'pt' ? 'pt' : null, ptId: f.back === 'pt' ? f.pid : st.ptId
      };
    });
  }
  saveTx(rid) {
    var text = String(this.state.txText || '').trim();
    if (!text) return;
    var t = Date.now();
    this.setState(function (st) {
      var id = uid();
      return { nextRid: id + 1, txFor: null, txText: '',
        recs: st.recs.map(function (r) { return r.id === rid ? Object.assign({}, r, { tx: r.tx.concat([{ id: id, at: t, text: text }]) }) : r; }) };
    });
  }
  discharge(id) {
    var p = this.pById(id);
    this.setState({ modal: 'out', oerr: '', oform: { pid: id, kind: p && p.outKind ? p.outKind : 'ra', time: dtLocal(p && p.outAt ? p.outAt : Date.now()), note: p && p.outNote ? p.outNote : '' } });
  }
  saveDischarge(e) {
    if (e && e.preventDefault) e.preventDefault();
    var f = this.state.oform, p = this.pById(f.pid);
    var t = new Date(f.time).getTime();
    if (!f.time || isNaN(t)) { this.setState({ oerr: 'Chọn giờ ra viện.' }); return; }
    if (p && t < p.admitAt) { this.setState({ oerr: 'Giờ ra viện phải sau giờ nhập viện (' + hm(p.admitAt) + ' ' + dmy(p.admitAt) + ').' }); return; }
    var id = f.pid, note = String(f.note || '').trim(), kind = f.kind || 'ra';
    this.setState(function (st) {
      return {
        modal: null, oerr: '', now: Date.now(),
        patients: st.patients.map(function (x) { return x.id === id ? Object.assign({}, x, { status: 'out', outAt: t, outNote: note, outKind: kind }) : x; }),
        sform: st.sform.patientId === id && t <= Date.now() ? Object.assign({}, st.sform, { patientId: null }) : st.sform
      };
    });
  }
  cancelDischarge(id) {
    this.setState(function (st) {
      return { modal: null, patients: st.patients.map(function (x) { return x.id === id ? Object.assign({}, x, { status: 'in', outAt: null, outNote: '' }) : x; }) };
    });
  }
  addSched(e) {
    if (e && e.preventDefault) e.preventDefault();
    var f = this.state.sform;
    if (!f.patientId) { this.setState({ serr: 'Chọn bệnh nhân.' }); return; }
    if (!String(f.site).trim()) { this.setState({ serr: f.type === 'tiem' ? 'Chọn hoặc nhập vị trí khớp cần tiêm.' : 'Chọn hoặc nhập vùng khảo sát điện cơ.' }); return; }
    if (!f.date || !f.time) { this.setState({ serr: 'Chọn ngày và giờ.' }); return; }
    var clash = this.state.scheds.find(function (x) { return !x.done && x.type === f.type && x.date === f.date && x.time === f.time; });
    if (clash) {
      var cp = this.pById(clash.patientId);
      this.setState({ serr: 'Trùng giờ: đã có ' + TYPE[f.type].toLowerCase() + ' lúc ' + f.time + ' ngày ' + dm(fromIso(f.date)) + ' cho ' + (cp ? cp.name : 'bệnh nhân khác') + '.' });
      return;
    }
    this.setState(function (st) {
      var x = Object.assign({}, f, { site: String(f.site).trim(), id: uid(), done: false });
      return { scheds: st.scheds.concat([x]), nextSid: uid() + 1, serr: '', modal: null, sform: Object.assign({}, st.sform, { site: '', note: '' }) };
    });
  }
  copy(key, text) {
    var self = this;
    var ok = function () { self.setState({ copied: key }); clearTimeout(self.ct); self.ct = setTimeout(function () { self.setState({ copied: '' }); }, 2000); };
    var fail = function () { self.setState({ copied: 'fail:' + key }); };
    try { navigator.clipboard.writeText(text).then(ok, fail); } catch (err) { fail(); }
  }
  gbText() {
    var k = this.snapshot(), self = this, L = [], beds = this.bedsN();
    L.push('GIAO BAN – ĐƠN NGUYÊN CƠ XƯƠNG KHỚP');
    L.push(WDL[new Date(k.now).getDay()] + ', ' + dmy(k.now) + ' (lập lúc ' + hm(Date.now()) + ')');
    L.push('Đang điều trị: ' + k.active.length + '/' + beds + ' giường (' + Math.round(k.active.length / beds * 100) + '%) | Nhập mới 24h: ' + k.newIn.length + ' | Ra viện 24h: ' + k.out.length + ' | DHST bất thường: ' + k.bad.length);
    L.push(''); L.push('DANH SÁCH BỆNH NHÂN');
    k.active.forEach(function (p, i) {
      L.push((i + 1) + '. ' + p.room + ' – ' + p.name + (p.age ? ', ' + p.age + 't' : '') + ' – nhập ' + hm(p.admitAt) + ' ' + dm(p.admitAt));
      var v = vitalLine(p); if (v) L.push('   DHST: ' + v);
      if (p.note) L.push('   Ghi chú: ' + p.note);
    });
    L.push(''); L.push('CHỈ ĐỊNH HÔM NAY');
    if (!k.todayP.length) L.push('Không có.');
    k.todayP.forEach(function (x) {
      var p = self.pById(x.patientId);
      L.push('- ' + x.time + ' ' + TYPE[x.type] + ' – ' + (p ? p.room + ' ' + p.name : '?') + ' – ' + x.site + (x.who ? ' – ' + x.who : '') + (x.done ? ' (đã làm)' : ''));
    });
    var nt = Date.now();
    var outs = this.state.patients.filter(function (p) { return p.status === 'out' && p.outAt != null && (p.outAt > nt || nt - p.outAt < DAY); }).sort(function (a, b) { return a.outAt - b.outAt; });
    L.push(''); L.push('BÁO RA VIỆN (24h qua & sắp ra)');
    if (!outs.length) L.push('Không có.');
    outs.forEach(function (p) { L.push('- ' + p.room + ' ' + p.name + ' – ra ' + hm(p.outAt) + ' ' + dm(p.outAt) + (p.outAt > nt ? ' (chờ ra)' : '') + (p.outNote ? ' – ' + p.outNote : '')); });
    return L.join('\n');
  }
  dutyCalc(dateIso) {
    var s = this.state, start = fromIso(dateIso) + 7 * HOUR, end = start + DAY, cap = Math.min(end, Date.now());
    var present = function (p, t) { return p.admitAt <= t && !(p.status === 'out' && p.outAt <= t); };
    var cu = s.patients.filter(function (p) { return present(p, start); }).length;
    var vao = s.patients.filter(function (p) { return p.admitAt > start && p.admitAt <= cap; }).length;
    var outs = s.patients.filter(function (p) { return p.status === 'out' && p.outAt > start && p.outAt <= cap; });
    var kc = function (k) { return outs.filter(function (p) { return (p.outKind || 'ra') === k; }).length; };
    var ra = kc('ra'), ck = kc('ck'), cv = kc('cv');
    var tiems = s.scheds.filter(function (x) { return x.type === 'tiem' && x.date === dateIso; });
    return { start: start, end: end, cu: cu, vao: vao, ra: ra, ck: ck, cv: cv, con: cu + vao - ra - ck - cv,
      tiem: tiems.length, tiemDone: tiems.filter(function (x) { return x.done; }).length,
      admits: s.patients.filter(function (p) { return p.admitAt > start && p.admitAt <= cap; }).sort(function (a, b) { return a.admitAt - b.admitAt; })
        .map(function (p) { return { name: p.name, age: p.age || '', room: p.room, at: p.admitAt, note: p.note || '' }; }),
      evs: s.recs.filter(function (r) { return r.abn && r.at > start && r.at <= cap; }).sort(function (a, b) { return a.at - b.at; }).map(function (r) {
        var p = s.patients.find(function (x) { return x.id === r.pid; }) || {};
        return { pid: r.pid, name: p.name || '?', room: p.room || '', at: r.at, note: r.note, vit: vitalLine(r), tx: r.tx.map(function (x) { return { at: x.at, text: x.text }; }) };
      }),
      transfers: outs.filter(function (p) { return p.outKind === 'ck' || p.outKind === 'cv'; }).sort(function (a, b) { return a.outAt - b.outAt; })
        .map(function (p) { return { name: p.name, age: p.age || '', room: p.room, at: p.outAt, kind: p.outKind, note: p.outNote || '' }; }) };
  }
  autoBlocks(evs) {
    var out = [], idx = {};
    (evs || []).forEach(function (e) {
      var b = idx[e.pid];
      if (!b) { b = idx[e.pid] = { name: e.name, room: e.room, notes: [] }; out.push(b); }
      b.notes.push(hm(e.at) + ' ' + dm(e.at) + ': ' + (e.note || 'Bất thường DHST') + (e.vit ? ' (DHST: ' + e.vit + ')' : ''));
      e.tx.forEach(function (x) { b.notes.push('→ Xử trí ' + hm(x.at) + ': ' + x.text); });
    });
    return out;
  }
  allBlocks(r) { return this.autoBlocks(r.stats && r.stats.evs).concat(r.blocks); }
  windowText(c) { return 'Từ 07:00 ' + dm(c.start) + ' đến 07:00 ' + dmy(c.end); }
  cleanBlocks() {
    return this.state.dvb.map(function (b) {
      return { name: String(b.name).trim(), room: String(b.room).trim(), notes: b.notes.map(function (n) { return String(n.text).trim(); }).filter(Boolean) };
    }).filter(function (b) { return b.name || b.room || b.notes.length; });
  }
  dutyText(r) {
    var c = r.stats, L = [];
    L.push('BÁO CÁO TRỰC – ĐƠN NGUYÊN CƠ XƯƠNG KHỚP');
    L.push('Ngày trực: ' + dmy(fromIso(r.date)) + ' (' + this.windowText(c) + ')');
    L.push('BS trực: ' + r.doctor + (r.nurse ? ' · ĐD trực: ' + r.nurse : ''));
    L.push('Cũ: ' + c.cu + ' | Vào: ' + c.vao + ' | Ra: ' + c.ra + ' | Chuyển khoa: ' + c.ck + ' | Chuyển viện: ' + c.cv + ' | Còn: ' + c.con);
    L.push('Tiêm khớp: ' + c.tiem + ' ca' + (c.tiem ? ' (đã làm ' + c.tiemDone + ')' : ''));
    L.push(''); L.push('BỆNH NHÂN VÀO VIỆN (' + (c.admits || []).length + ')');
    if (!(c.admits || []).length) L.push('Không có.');
    (c.admits || []).forEach(function (a, i) { L.push((i + 1) + '. ' + a.name + (a.age ? ', ' + a.age + 't' : '') + ' – ' + a.room + ' – vào ' + hm(a.at) + ' ' + dm(a.at) + (a.note ? ' – ' + a.note : '')); });
    var tf = c.transfers || [];
    L.push(''); L.push('BỆNH NHÂN CHUYỂN (' + tf.length + ')');
    if (!tf.length) L.push('Không có.');
    tf.forEach(function (a, i) { L.push((i + 1) + '. ' + a.name + (a.age ? ', ' + a.age + 't' : '') + ' – ' + a.room + ' – ' + KIND[a.kind] + ' lúc ' + hm(a.at) + ' ' + dm(a.at) + (a.note ? ' – ' + a.note : '')); });
    L.push(''); L.push('DIỄN BIẾN');
    var BL = this.allBlocks(r);
    if (!BL.length) L.push('Không có diễn biến đặc biệt.');
    BL.forEach(function (b, i) {
      L.push((i + 1) + '. ' + (b.name || '(chưa ghi tên)') + (b.room ? ' – Phòng ' + b.room : ''));
      b.notes.forEach(function (n) { L.push('   - ' + n); });
    });
    return L.join('\n');
  }
  updBlock(bid, fn) { this.setState(function (st) { return { derr: '', dvb: st.dvb.map(function (b) { return b.id === bid ? fn(b) : b; }) }; }); }
  addBlockAfter(bid) {
    this.setState(function (st) {
      var i = st.dvb.findIndex(function (b) { return b.id === bid; }), nb = { id: st.nextDid, name: '', room: '', notes: [{ id: st.nextDid + 1, text: '' }] };
      var arr = st.dvb.slice(); arr.splice(i + 1, 0, nb);
      return { dvb: arr, nextDid: st.nextDid + 2 };
    });
  }
  removeBlock(bid) {
    this.setState(function (st) {
      var arr = st.dvb.filter(function (b) { return b.id !== bid; });
      if (!arr.length) arr = [{ id: st.nextDid, name: '', room: '', notes: [{ id: st.nextDid + 1, text: '' }] }];
      return { dvb: arr, nextDid: st.nextDid + 2 };
    });
  }
  addNoteAfter(bid, nid) {
    this.setState(function (st) {
      var id = st.nextDid;
      return { nextDid: id + 1, dvb: st.dvb.map(function (b) {
        if (b.id !== bid) return b;
        var i = b.notes.findIndex(function (n) { return n.id === nid; }), ns = b.notes.slice(); ns.splice(i + 1, 0, { id: id, text: '' });
        return Object.assign({}, b, { notes: ns });
      }) };
    });
  }
  removeNote(bid, nid) {
    this.setState(function (st) {
      var id = st.nextDid;
      return { nextDid: id + 1, dvb: st.dvb.map(function (b) {
        if (b.id !== bid) return b;
        var ns = b.notes.filter(function (n) { return n.id !== nid; });
        if (!ns.length) ns = [{ id: id, text: '' }];
        return Object.assign({}, b, { notes: ns });
      }) };
    });
  }
  saveReport() {
    var d = this.state.duty, ed = this.state.editingId;
    if (!d.doctor.trim()) { this.setState({ derr: 'Nhập tên bác sĩ trực.' }); return; }
    if (!d.date) { this.setState({ derr: 'Chọn ngày trực.' }); return; }
    var t = Date.now();
    var r = { id: ed || t, savedAt: t, date: d.date, doctor: d.doctor.trim(), nurse: d.nurse.trim(), stats: this.dutyCalc(d.date), blocks: this.cleanBlocks() };
    r.text = this.dutyText(r);
    this.setState(function (st) {
      var reps = ed ? st.reports.map(function (x) { return x.id === ed ? r : x; }) : [r].concat(st.reports);
      return { reports: reps, derr: '', editingId: null, nextDid: st.nextDid + 2,
        dvb: [{ id: st.nextDid, name: '', room: '', notes: [{ id: st.nextDid + 1, text: '' }] }] };
    });
  }
  editReport(r) {
    this.setState(function (st) {
      var id = st.nextDid, dvb = r.blocks.map(function (b) {
        var bid = id++; var ns = (b.notes.length ? b.notes : ['']).map(function (n) { return { id: id++, text: n }; });
        return { id: bid, name: b.name, room: b.room, notes: ns };
      });
      if (!dvb.length) dvb = [{ id: id++, name: '', room: '', notes: [{ id: id++, text: '' }] }];
      return { tab: 'truc', modal: null, editingId: r.id, derr: '', duty: { date: r.date, doctor: r.doctor, nurse: r.nurse }, dvb: dvb, nextDid: id };
    });
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
  }
  cancelEdit() {
    this.setState(function (st) {
      return { editingId: null, derr: '', duty: Object.assign({}, st.duty, { doctor: '', nurse: '' }), nextDid: st.nextDid + 2,
        dvb: [{ id: st.nextDid, name: '', room: '', notes: [{ id: st.nextDid + 1, text: '' }] }] };
    });
  }
  setPdf(id, v) { this.setState(function (st) { var o = Object.assign({}, st.pdf); o[id] = v; return { pdf: o }; }); }
  async loadFonts() {
    if (this.fonts) return this.fonts;
    var b64 = function (buf) { var u = new Uint8Array(buf), s = '', CH = 0x8000; for (var i = 0; i < u.length; i += CH) s += String.fromCharCode.apply(null, u.subarray(i, i + CH)); return btoa(s); };
    var res = await Promise.all(['vendor/bvp-regular.ttf', 'vendor/bvp-bold.ttf'].map(function (u) {
      return fetch(u).then(function (x) { if (!x.ok) throw new Error('font'); return x.arrayBuffer(); });
    }));
    this.fonts = { r: b64(res[0]), b: b64(res[1]) };
    return this.fonts;
  }
  async downloadPdf(r) {
    var self = this;
    this.setPdf(r.id, { busy: true });
    try {
      var lib = window.jspdf && window.jspdf.jsPDF;
      if (!lib) throw new Error('Không tải được thư viện tạo PDF.');
      var fonts = await this.loadFonts();
      var doc = new lib({ unit: 'mm', format: 'a4' });
      doc.addFileToVFS('bvp-r.ttf', fonts.r); doc.addFont('bvp-r.ttf', 'BVP', 'normal');
      doc.addFileToVFS('bvp-b.ttf', fonts.b); doc.addFont('bvp-b.ttf', 'BVP', 'bold');
      var N = function (x) { return String(x == null ? '' : x).normalize('NFC'); };
      var M = 16, W = 210 - 2 * M, y = 18;
      var txt = function (str, x, yy, o) { doc.text(N(str), x, yy, o || {}); };
      var ensure = function (h) { if (y + h > 282) { doc.addPage(); y = 18; } };
      doc.setFont('BVP', 'bold'); doc.setFontSize(10); doc.setTextColor(60, 70, 66);
      txt('ĐƠN NGUYÊN CƠ XƯƠNG KHỚP', M, y);
      doc.setFont('BVP', 'normal'); txt('Lập lúc ' + hm(r.savedAt) + ' ' + dmy(r.savedAt), 210 - M, y, { align: 'right' });
      y += 12; doc.setTextColor(20, 30, 28); doc.setFont('BVP', 'bold'); doc.setFontSize(17);
      txt('BÁO CÁO TRỰC', 105, y, { align: 'center' });
      y += 7; doc.setFont('BVP', 'normal'); doc.setFontSize(10.5);
      txt('Ngày trực ' + dmy(fromIso(r.date)) + ' · ' + this.windowText(r.stats), 105, y, { align: 'center' });
      y += 10; doc.setFontSize(11);
      doc.setFont('BVP', 'bold'); txt('Bác sĩ trực:', M, y); doc.setFont('BVP', 'normal'); txt(r.doctor, M + 25, y);
      if (r.nurse) { doc.setFont('BVP', 'bold'); txt('Điều dưỡng trực:', 110, y); doc.setFont('BVP', 'normal'); txt(r.nurse, 143, y); }
      y += 7;
      var c = r.stats, cells = [['Cũ', c.cu], ['Vào', c.vao], ['Ra', c.ra], ['Chuyển khoa', c.ck], ['Chuyển viện', c.cv], ['Còn', c.con], ['Tiêm khớp', c.tiem]];
      var cw = W / cells.length;
      doc.setDrawColor(150, 160, 156); doc.setLineWidth(0.3);
      cells.forEach(function (cl, i) {
        var x = M + i * cw;
        doc.setFillColor(236, 242, 239); doc.rect(x, y, cw, 8, 'FD'); doc.rect(x, y + 8, cw, 11);
        doc.setFont('BVP', 'bold'); doc.setFontSize(9.5); txt(cl[0], x + cw / 2, y + 5.4, { align: 'center' });
        doc.setFontSize(15); txt(String(cl[1]), x + cw / 2, y + 16, { align: 'center' });
      });
      y += 25;
      if (c.tiem) { doc.setFont('BVP', 'normal'); doc.setFontSize(10); txt('Tiêm khớp: ' + c.tiem + ' ca, đã thực hiện ' + c.tiemDone + '.', M, y); y += 7; }
      var table = function (title, cols, rows) {
        ensure(20);
        doc.setFont('BVP', 'bold'); doc.setFontSize(12.5); doc.setTextColor(20, 30, 28); txt(title + ' (' + rows.length + ')', M, y); y += 2;
        doc.setDrawColor(14, 107, 94); doc.setLineWidth(0.5); doc.line(M, y, M + W, y); y += 5;
        if (!rows.length) { doc.setFont('BVP', 'normal'); doc.setFontSize(11); txt('Không có.', M, y); y += 8; return; }
        var drawHead = function () {
          var x = M; doc.setFillColor(236, 242, 239); doc.rect(M, y - 4.2, W, 6.4, 'F');
          doc.setFont('BVP', 'bold'); doc.setFontSize(9.5);
          cols.forEach(function (cl) { txt(cl[1], x + 1, y); x += cl[0]; }); y += 5;
        };
        drawHead();
        doc.setDrawColor(200, 206, 203); doc.setLineWidth(0.2);
        rows.forEach(function (row) {
          doc.setFont('BVP', 'normal'); doc.setFontSize(10);
          var cells = row.map(function (v, k) { return doc.splitTextToSize(N(v || '–'), cols[k][0] - 2); });
          var h = Math.max.apply(null, cells.map(function (c2) { return c2.length; })) * 4.6 + 1.6;
          if (y + h > 282) { doc.addPage(); y = 18; drawHead(); doc.setFont('BVP', 'normal'); doc.setFontSize(10); }
          var x = M;
          cells.forEach(function (c2, k) { doc.text(c2, x + 1, y); x += cols[k][0]; });
          y += h - 1.6; doc.line(M, y - 2.6, M + W, y - 2.6); y += 1.6;
        });
        y += 4;
      };
      table('BỆNH NHÂN VÀO VIỆN', [[8, 'TT'], [52, 'Họ tên'], [12, 'Tuổi'], [16, 'Phòng'], [24, 'Giờ vào'], [W - 112, 'Ghi chú']],
        (c.admits || []).map(function (a, i) { return [String(i + 1), a.name, a.age, a.room, hm(a.at) + ' ' + dm(a.at), a.note]; }));
      table('BỆNH NHÂN CHUYỂN', [[8, 'TT'], [46, 'Họ tên'], [12, 'Tuổi'], [16, 'Phòng'], [24, 'Hình thức'], [22, 'Giờ'], [W - 128, 'Nơi chuyển / ghi chú']],
        (c.transfers || []).map(function (a, i) { return [String(i + 1), a.name, a.age, a.room, KIND[a.kind], hm(a.at) + ' ' + dm(a.at), a.note]; }));
      ensure(16);
      doc.setFont('BVP', 'bold'); doc.setFontSize(12.5); txt('DIỄN BIẾN', M, y); y += 2;
      doc.setDrawColor(14, 107, 94); doc.setLineWidth(0.5); doc.line(M, y, M + W, y); y += 6;
      var BL = this.allBlocks(r);
      if (!BL.length) { doc.setFont('BVP', 'normal'); doc.setFontSize(11); txt('Không có diễn biến đặc biệt.', M, y); y += 7; }
      BL.forEach(function (b, i) {
        ensure(14);
        doc.setFont('BVP', 'bold'); doc.setFontSize(11.5);
        txt((i + 1) + '. ' + (b.name || '(chưa ghi tên)') + (b.room ? '  –  Phòng ' + b.room : ''), M, y); y += 6;
        doc.setFont('BVP', 'normal'); doc.setFontSize(11);
        if (!b.notes.length) { txt('–', M + 6, y); y += 6; }
        b.notes.forEach(function (n) {
          var lines = doc.splitTextToSize(N(n), W - 10);
          ensure(lines.length * 5.2 + 1);
          txt('•', M + 4, y); doc.text(lines, M + 9, y); y += lines.length * 5.2 + 1.2;
        });
        y += 3;
      });
      ensure(36); y += 8;
      doc.setFont('BVP', 'bold'); doc.setFontSize(11); txt('BÁC SĨ TRỰC', 150, y, { align: 'center' });
      doc.setFont('BVP', 'normal'); doc.setFontSize(9.5); txt('(Ký, ghi rõ họ tên)', 150, y + 5, { align: 'center' });
      doc.setFont('BVP', 'bold'); doc.setFontSize(11); txt(r.doctor, 150, y + 26, { align: 'center' });
      var blob = doc.output('blob'), name = 'bao-cao-truc-' + r.date + '.pdf';
      var dl = null;
      try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e1) { dl = null; }
      if (dl) {
        try { await dl.save({ filename: name, data: blob }); this.setPdf(r.id, { done: true }); }
        catch (e2) { this.setPdf(r.id, e2 && e2.code === 'declined' ? {} : { err: 'Không tải được file (' + (e2 && e2.code || 'lỗi') + ').' }); }
      } else {
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        this.setPdf(r.id, { done: true });
      }
    } catch (err) {
      self.setPdf(r.id, { err: (err && err.message) || 'Không tạo được PDF.' });
    }
  }

  renderVals() {
    var self = this, s = this.state, k = this.snapshot(), today = k.today, beds = this.bedsN();
    var on = {};
    ['name', 'age', 'room', 'pulse', 'bp', 'temp', 'spo2', 'rr', 'note'].forEach(function (f) { on[f] = self.setIn('form', f); });
    on.q = function (e) { self.setState({ q: e.target.value }); };
    on.editAt = function (e) { self.setState({ editAt: e.target.value, err: '' }); };
    on.vDate = function (e) { self.setState({ vdate: e.target.value }); };
    on.txText = function (e) { self.setState({ txText: e.target.value }); };
    on.beds = function (e) { self.setState({ beds: e.target.value }); };
    on.sSite = this.setIn('sform', 'site'); on.sDate = this.setIn('sform', 'date'); on.sTime = this.setIn('sform', 'time');
    on.sWho = this.setIn('sform', 'who'); on.sNote = this.setIn('sform', 'note');
    on.dDate = this.setIn('duty', 'date'); on.dDoctor = this.setIn('duty', 'doctor'); on.dNurse = this.setIn('duty', 'nurse');
    var go = function (tab) { return function () { self.setState({ tab: tab, confirmId: null }); }; };

    var pendingToday = k.todayP.filter(function (x) { return !x.done; }).length;
    var tabs = [['dash', 'Tổng quan', 0, 'Tổng quan'], ['bn', 'Bệnh nhân', k.active.length, 'BN'], ['dhst', 'DHST/Diễn biến', 0, 'DHST'], ['truc', 'Báo cáo trực', 0, 'Trực'], ['lich', 'Lịch chỉ định', pendingToday, 'Lịch']].map(function (t) {
      return { label: t[1], short: t[3], cls: s.tab === t[0] ? 'tab tab-on' : 'tab', hasBadge: t[2] > 0, badge: t[2], go: go(t[0]) };
    });

    // Dashboard
    var todayStart = fromIso(today), series = [], maxIO = 1, list = s.patients;
    for (var i = 13; i >= 0; i--) {
      var a = todayStart - i * DAY, b = a + DAY;
      var nin = list.filter(function (p) { return p.admitAt >= a && p.admitAt < b; }).length;
      var nout = list.filter(function (p) { return isOut(p) && p.outAt >= a && p.outAt < b; }).length;
      var end = Math.min(b, k.now);
      var census = list.filter(function (p) { return p.admitAt < end && (isIn(p) || p.outAt >= end); }).length;
      maxIO = Math.max(maxIO, nin, nout);
      series.push({ a: a, nin: nin, nout: nout, census: census, isToday: i === 0 });
    }
    var maxV = Math.max(beds, 1, Math.max.apply(null, series.map(function (d) { return Math.max(d.census, d.nin, d.nout); })));
    var yv = function (v) { return Math.round(v / maxV * 160); };
    var pts = function (key) { return series.map(function (d, i) { return ((i + 0.5) * 100) + ',' + (160 - yv(d[key])); }).join(' '); };
    var inPts = pts('nin'), outPts = pts('nout');
    series = series.map(function (d) {
      var wd = WD[new Date(d.a).getDay()];
      return {
        label: d.isToday ? 'Hôm nay' : dm(d.a), lblCls: d.isToday ? 'day-lbl day-today' : 'day-lbl',
        census: d.census, cenH: yv(d.census), inDot: yv(d.nin) - 4, outDot: yv(d.nout) - 4,
        tip: wd + ' ' + dm(d.a) + ': tổng ' + d.census + ' BN (' + Math.round(d.census / beds * 100) + '% giường) · vào ' + d.nin + ' · ra ' + d.nout
      };
    });
    var occ = Math.round(k.active.length / beds * 100);
    var in7 = 0, out7 = 0, from7 = todayStart - 6 * DAY;
    list.forEach(function (p) { if (p.admitAt >= from7) in7++; if (isOut(p) && p.outAt >= from7) out7++; });
    var inToday = list.filter(function (p) { return p.admitAt >= todayStart; }).length;
    var outToday = list.filter(function (p) { return isOut(p) && p.outAt >= todayStart; }).length;
    var tiemToday = k.todayP.filter(function (x) { return x.type === 'tiem'; }).length;
    var newSorted = k.newIn.slice().sort(byAdmitDesc);
    var newList = newSorted.slice(0, 5).map(function (p) { return { room: p.room, name: p.name, age: ageText(p), admit: hm(p.admitAt) + ' ' + dm(p.admitAt) }; });

    var mk = function (label, isOn, pick) { return { label: label, cls: isOn ? 'chip chip-on' : 'chip', pick: pick }; };
    // Patients
    var q = s.q.trim().toLowerCase();
    var match = function (p) { return !q || (p.name + ' ' + p.room).toLowerCase().indexOf(q) >= 0; };
    var row = function (p) {
      var pending = p.status === 'out' && p.outAt > Date.now();
      return {
        name: p.name, room: p.room, age: ageText(p), admit: hm(p.admitAt) + ' · ' + dm(p.admitAt),
        confirming: false, pending: pending, pendingText: pending ? 'Báo ra ' + hm(p.outAt) + ' ' + dm(p.outAt) : '',
        outLabel: pending ? 'Sửa báo ra viện' : 'Ra viện', outCls: 'btn-g',
        order: function () { self.openOrder(p.id); },
        dhst: function () { self.openPt(p.id); },
        editInfo: function () { self.openEditPt(p.id); },
        discharge: function () { self.discharge(p.id); }
      };
    };
    var newIds = {}; k.newIn.forEach(function (p) { newIds[p.id] = 1; });
    var newRows = newSorted.filter(match).map(row);
    var oldRows = k.active.filter(function (p) { return !newIds[p.id] && match(p); }).map(row);
    var nowT = Date.now();
    var outAll = list.filter(function (p) { return p.status === 'out' && p.outAt != null; }).sort(function (x, y) {
      var px = x.outAt > nowT, py = y.outAt > nowT;
      if (px !== py) return px ? -1 : 1;
      return px ? x.outAt - y.outAt : y.outAt - x.outAt;
    });
    var pendingCount = outAll.filter(function (p) { return p.outAt > nowT; }).length;
    var outRows = outAll.filter(match).map(function (p) {
      var days = Math.max(1, Math.round((p.outAt - p.admitAt) / DAY)), pend = p.outAt > nowT;
      return { name: p.name, room: p.room, age: ageText(p), admit: dm(p.admitAt), out: hm(p.outAt) + ' ' + dmy(p.outAt), los: days + ' ngày',
        note: p.outNote || '', hasNote: !!p.outNote, tagCls: pend ? 'tag tag-new' : 'tag tag-done', tag: (pend ? 'Chờ ' : 'Đã ') + KIND[p.outKind || 'ra'].toLowerCase(),
        roomStyle: pend ? 'background: #0F2F2A' : 'background: #56615C',
        dhst: function () { self.openPt(p.id); },
        edit: function () { self.discharge(p.id); } };
    });
    var op2 = s.oform ? this.pById(s.oform.pid) : null;

    // DHST
    var vcell = function (x) { return { text: x.raw, cls: x.bad ? 'c-bad' : '' }; };
    var vd = s.vdate || today, dS = fromIso(vd), dE = dS + DAY;
    var dayItems = function (p) {
      var arr = s.recs.filter(function (r) { return r.pid === p.id && r.at >= dS && r.at < dE; }).map(function (r) { return { r: r, admit: false }; });
      if (p.av && p.admitAt >= dS && p.admitAt < dE && hasVit(p.av)) arr.push({ r: Object.assign({ at: p.admitAt, note: '', abn: false, tx: [] }, p.av), admit: true });
      return arr.sort(function (a, b) { return a.r.at - b.r.at; });
    };
    var vIds = {}; k.active.forEach(function (p) { if (p.admitAt < dE) vIds[p.id] = 1; });
    s.recs.forEach(function (r) { if (r.at >= dS && r.at < dE) vIds[r.pid] = 1; });
    var vPts = s.patients.filter(function (p) { return vIds[p.id]; }).sort(byRoom);
    var roomList = []; vPts.forEach(function (p) { if (roomList.indexOf(p.room) < 0) roomList.push(p.room); });
    var vRoomChips = [mk('Tất cả', s.vroom === 'all', function () { self.setState({ vroom: 'all' }); })].concat(roomList.map(function (rm) { return mk(rm, s.vroom === rm, function () { self.setState({ vroom: rm }); }); }));
    var vRooms = roomList.filter(function (rm) { return s.vroom === 'all' || s.vroom === rm; }).map(function (rm) {
      var ps = vPts.filter(function (p) { return p.room === rm; });
      return { room: rm, count: ps.length, patients: ps.map(function (p) {
        var rows = dayItems(p).map(function (it) {
          var r = it.r, v = vitals(r);
          return { time: hm(r.at), m: vcell(v[0]), ha: vcell(v[1]), t: vcell(v[2]), o: vcell(v[3]), r: vcell(v[4]),
            hasNote: !!(r.note || it.admit), note: it.admit ? (p.note || '') : r.note,
            tag: it.admit ? 'Nhập viện' : (r.abn ? 'Bất thường' : 'Ghi chú'), tagCls: it.admit ? 'tag tag-dien' : (r.abn ? 'tag tag-new' : 'tag tag-done') };
        });
        var out = isOut(p);
        return { name: p.name, age: ageText(p), isOut: out, outTag: out ? KIND[p.outKind || 'ra'] : '', rows: rows, hasRows: rows.length > 0, noRows: !rows.length,
          add: function () { self.openRec(p.id, null); }, view: function () { self.openPt(p.id); } };
      }) };
    });
    var vDayLabel = (vd === today ? 'Hôm nay · ' : '') + WDL[new Date(dS).getDay()] + ', ' + dmy(dS) + ' · DHST thường quy không đưa vào báo cáo trực';
    // patient record modal
    var pp = s.ptId ? this.pById(s.ptId) : null, pv = {};
    if (pp) {
      var its = s.recs.filter(function (r) { return r.pid === pp.id; }).map(function (r) { return { r: r, admit: false }; });
      its.push({ r: Object.assign({ id: 'adm', at: pp.admitAt, note: pp.note || '', abn: false, tx: [] }, pp.av || {}), admit: true });
      its.sort(function (a, b) { return b.r.at - a.r.at; });
      pv = { name: pp.name, room: pp.room, canAdd: isIn(pp),
        info: ageText(pp) + ' · vào ' + hm(pp.admitAt) + ' ' + dmy(pp.admitAt) + (isOut(pp) ? ' · ' + KIND[pp.outKind || 'ra'].toLowerCase() + ' ' + hm(pp.outAt) + ' ' + dm(pp.outAt) : ''),
        add: function () { self.openRec(pp.id, 'pt'); },
        items: its.map(function (it) {
          var r = it.r, vv = vitals(r).filter(function (x) { return x.has; }).map(function (x) { return { label: x.label, text: x.text, cls: x.bad ? 'v v-bad' : 'v' }; });
          var open = !it.admit && s.txFor === r.id;
          return { when: hm(r.at) + ' · ' + dmy(r.at), tag: it.admit ? 'Nhập viện' : (r.abn ? 'Diễn biến bất thường' : (r.note ? 'Diễn biến' : 'DHST')),
            tagCls: it.admit ? 'tag tag-dien' : (r.abn ? 'tag tag-new' : 'tag tag-done'),
            vit: vv, hasVit: vv.length > 0, note: r.note, hasNote: !!r.note,
            txs: (r.tx || []).map(function (x) { return { when: hm(x.at) + ' ' + dm(x.at), text: x.text }; }),
            txOpen: open, txBtn: !it.admit && !open, txId: 'tx' + r.id,
            openTx: function () { self.setState({ txFor: r.id, txText: '' }); },
            saveTx: function () { self.saveTx(r.id); } };
        }) };
    }
    var rf = s.rform, rp = rf && rf.pid ? this.pById(rf.pid) : null;
    var on3 = {};
    VKEYS.concat(['tx']).forEach(function (kk) { on3[kk] = function (e) { var v = e.target.value; self.setState(function (st) { var o = Object.assign({}, st.rform); o[kk] = v; return { rform: o, rerr: '' }; }); }; });
    on3.note = function (e) { var v = e.target.value; self.setState(function (st) { var o = Object.assign({}, st.rform, { note: v }); if (!o.abnTouched) o.abn = v.trim() !== ''; return { rform: o, rerr: '' }; }); };
    on3.abn = function (e) { var c = !!e.target.checked; self.setState(function (st) { return { rform: Object.assign({}, st.rform, { abn: c, abnTouched: true }) }; }); };
    on3.showTx = function () { self.setState(function (st) { return { rform: Object.assign({}, st.rform, { showTx: true }) }; }); };
    var recPtChips = k.active.map(function (p) { return mk(p.room + ' · ' + p.name, rf && rf.pid === p.id, function () { self.setState(function (st) { return { rform: Object.assign({}, st.rform, { pid: p.id }), rerr: '' }; }); }); });

    // Giao ban
    var stats = [
      { n: k.active.length + '/' + beds, label: 'Giường sử dụng (' + occ + '%)', cls: 'stat' },
      { n: k.newIn.length, label: 'Nhập mới 24h', cls: 'stat' },
      { n: k.out.length, label: 'Ra viện 24h', cls: 'stat' },
      { n: k.bad.length, label: 'DHST bất thường', cls: k.bad.length ? 'stat stat-bad' : 'stat' },
      { n: tiemToday, label: 'Tiêm khớp hôm nay', cls: 'stat' },
      { n: k.todayP.length - tiemToday, label: 'Điện cơ hôm nay', cls: 'stat' }
    ];
    var gbRows = k.active.map(function (p, i) {
      var v = vitals(p); var c = function (x) { return { text: x.raw, cls: x.bad ? 'c-bad' : '' }; };
      return { stt: i + 1, name: p.name, age: p.age || '—', room: p.room, admit: hm(p.admitAt) + ' ' + dm(p.admitAt), m: c(v[0]), ha: c(v[1]), t: c(v[2]), o: c(v[3]), r: c(v[4]), note: p.note || '—' };
    });
    var todayItems = k.todayP.map(function (x) {
      var p = self.pById(x.patientId);
      return { time: x.time, typeLabel: TYPE[x.type], tagCls: 'tag tag-' + x.type, patient: p ? p.room + ' ' + p.name : '—', site: x.site, done: x.done };
    });
    var badItems = k.bad.map(function (p) { return { who: p.room + ' ' + p.name, text: badLine(p) }; });

    // Duty
    var dc = s.duty.date ? this.dutyCalc(s.duty.date) : null;
    var dStats = dc ? [['Cũ', dc.cu], ['Vào', dc.vao], ['Ra', dc.ra], ['Chuyển khoa', dc.ck], ['Chuyển viện', dc.cv], ['Còn', dc.con], ['Tiêm khớp', dc.tiem]].map(function (x, i) {
      return { label: x[0], n: x[1], cls: i === 5 ? 'stat stat-key' : (i === 6 ? 'stat stat-tiem' : 'stat') };
    }) : [];
    var activeAll = k.active;
    var dBlocks = s.dvb.map(function (b, bi) {
      var nm = String(b.name).trim().toLowerCase();
      var exact = activeAll.some(function (p) { return p.name.toLowerCase() === nm; });
      var sugg = nm.length >= 1 && !exact ? activeAll.filter(function (p) { return (p.name + ' ' + p.room).toLowerCase().indexOf(nm) >= 0; }).slice(0, 4).map(function (p) {
        return { label: p.room + ' · ' + p.name, pick: function () { self.updBlock(b.id, function (x) { return Object.assign({}, x, { name: p.name, room: p.room }); }); } };
      }) : [];
      return {
        n: bi + 1, name: b.name, room: b.room, nameId: 'dn' + b.id, roomId: 'dr' + b.id, sugg: sugg, hasSugg: sugg.length > 0,
        onName: function (e) { var v = e.target.value; self.updBlock(b.id, function (x) { return Object.assign({}, x, { name: v }); }); },
        onRoom: function (e) { var v = e.target.value; self.updBlock(b.id, function (x) { return Object.assign({}, x, { room: v }); }); },
        remove: function () { self.removeBlock(b.id); },
        addBlock: function () { self.addBlockAfter(b.id); },
        notes: b.notes.map(function (n, ni) {
          return { id: 'dt' + n.id, n: ni + 1, text: n.text, ph: 'Diễn biến ' + (ni + 1) + (ni === 0 ? ' – VD: 22h sốt 38.5°C, đã hạ sốt' : ''),
            onText: function (e) { var v = e.target.value; self.updBlock(b.id, function (x) { return Object.assign({}, x, { notes: x.notes.map(function (y) { return y.id === n.id ? { id: y.id, text: v } : y; }) }); }); },
            add: function () { self.addNoteAfter(b.id, n.id); },
            remove: function () { self.removeNote(b.id, n.id); } };
        })
      };
    });
    var statCells = function (c) {
      return [['Cũ', c.cu], ['Vào', c.vao], ['Ra', c.ra], ['Chuyển khoa', c.ck], ['Chuyển viện', c.cv], ['Còn', c.con], ['Tiêm khớp', c.tiem]].map(function (x, i) {
        return { label: x[0], n: x[1], cls: i === 5 ? 'stat stat-key' : (i === 6 ? 'stat stat-tiem' : 'stat') };
      });
    };
    var admitRows = function (list) { return (list || []).map(function (a, i) { return { n: i + 1, name: a.name, age: a.age ? a.age + ' tuổi' : 'chưa rõ tuổi', room: a.room, time: hm(a.at) + ' ' + dm(a.at), note: a.note, hasNote: !!a.note }; }); };
    var transferRows = function (list) { return (list || []).map(function (a, i) { return { n: i + 1, name: a.name, age: a.age ? a.age + ' tuổi' : 'chưa rõ tuổi', room: a.room, kind: KIND[a.kind], tagCls: a.kind === 'cv' ? 'tag tag-new' : 'tag tag-dien', time: hm(a.at) + ' ' + dm(a.at), note: a.note, hasNote: !!a.note }; }); };
    var repVM = function (r) {
      var key = 'r' + r.id, ps = s.pdf[r.id] || {};
      return { title: 'Trực ngày ' + dmy(fromIso(r.date)), sub: 'BS ' + r.doctor + (r.nurse ? ' · ĐD ' + r.nurse : ''),
        pdfLabel: ps.busy ? 'Đang tạo…' : ps.done ? 'Đã tải' : 'PDF', hasPdfErr: !!ps.err, pdfErr: ps.err || '',
        pdf: function () { if (!(self.state.pdf[r.id] || {}).busy) self.downloadPdf(r); },
        edit: function () { self.editReport(r); },
        view: function () { self.setState({ modal: 'view', viewId: r.id }); },
        copyLabel: s.copied === key ? 'Đã sao chép' : s.copied === 'fail:' + key ? 'Hãy bôi đen để chép' : 'Sao chép văn bản', copy: function () { self.copy(key, r.text); } };
    };
    var reports = s.reports.map(repVM);
    var vr = s.viewId ? s.reports.find(function (r) { return r.id === s.viewId; }) : null, rv = {};
    if (vr) {
      var vm = repVM(vr), ad = admitRows(vr.stats.admits);
      rv = Object.assign(vm, { window: this.windowText(vr.stats) + ' · lưu lúc ' + hm(vr.savedAt) + ' ' + dm(vr.savedAt), people: vm.sub,
        pdfLabel: vm.pdfLabel === 'PDF' ? 'Tải PDF' : vm.pdfLabel,
        stats: statCells(vr.stats), admits: ad, admitCount: ad.length, noAdmits: !ad.length,
        transfers: transferRows(vr.stats.transfers), transferCount: (vr.stats.transfers || []).length, noTransfers: !(vr.stats.transfers || []).length,
        blocks: this.allBlocks(vr).map(function (b, i) { return { n: i + 1, name: b.name || '(chưa ghi tên)', room: b.room || '', notes: (b.notes.length ? b.notes : ['–']).map(function (t) { return { text: t }; }) }; }),
        noBlocks: !this.allBlocks(vr).length });
    }

    // Orders
    var sf = s.sform, op = sf.patientId ? this.pById(sf.patientId) : null;
    var typeSeg = ['tiem', 'dien'].map(function (t) { return { label: TYPE[t], cls: sf.type === t ? 'seg-b seg-on' : 'seg-b', pick: function () { self.setState({ serr: '', sform: Object.assign({}, self.state.sform, { type: t, site: '' }) }); } }; });
    var fold = function (x) { return String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); };
    var picker = function (qKey, selId, setSel) {
      var p = selId ? self.pById(selId) : null, fq = fold(String(s[qKey] || '').trim());
      var sugg = !p && fq ? k.active.filter(function (pt) { return fold(pt.name + ' ' + pt.room).indexOf(fq) >= 0; }).slice(0, 6).map(function (pt) {
        return { room: pt.room, name: pt.name, age: ageText(pt), pick: function () { var o = {}; o[qKey] = ''; self.setState(o); setSel(pt.id); } };
      }) : [];
      return { sel: !!p, search: !p, room: p ? p.room : '', name: p ? p.name : '', info: p ? ageText(p) + ' · vào ' + dm(p.admitAt) : '',
        q: s[qKey] || '', sugg: sugg, hasSugg: sugg.length > 0, noMatch: !p && !!fq && !sugg.length,
        onQ: function (e) { var o = {}; o[qKey] = e.target.value; self.setState(o); }, clear: function () { setSel(null); } };
    };
    var pk1 = picker('pq1', sf.patientId, function (id) { self.setState(function (st) { return { serr: '', sform: Object.assign({}, st.sform, { patientId: id }) }; }); });
    var pk2 = picker('pq2', rf && rf.pid, function (id) { self.setState(function (st) { return { rerr: '', rform: Object.assign({}, st.rform, { pid: id }) }; }); });
    var ptChips = k.active.map(function (p) { return mk(p.room + ' · ' + p.name, sf.patientId === p.id, function () { self.setState({ serr: '', sform: Object.assign({}, self.state.sform, { patientId: p.id }) }); }); });
    var siteChips = SITES[sf.type].map(function (x) { return mk(x, sf.site === x, function () { self.setState({ serr: '', sform: Object.assign({}, self.state.sform, { site: x }) }); }); });

    var upcoming = s.scheds.filter(function (x) { return x.date >= today || !x.done; });
    var count = function (t) { return upcoming.filter(function (x) { return !x.done && (t === 'all' || x.type === t); }).length; };
    var filters = [['all', 'Tất cả'], ['tiem', 'Tiêm khớp'], ['dien', 'Điện cơ']].map(function (f) { return mk(f[1] + ' (' + count(f[0]) + ')', s.filter === f[0], function () { self.setState({ filter: f[0] }); }); });
    var groups = [];
    upcoming.filter(function (x) { return s.filter === 'all' || x.type === s.filter; }).sort(bySlot).forEach(function (x) {
      var g = groups[groups.length - 1];
      if (!g || g.date !== x.date) { g = { date: x.date, label: dayLabel(x.date, today), cls: x.date < today ? 'day-over' : '', items: [] }; groups.push(g); }
      var p = self.pById(x.patientId);
      g.items.push({
        time: x.time, typeLabel: TYPE[x.type], tagCls: 'tag tag-' + x.type, done: x.done,
        patient: p ? p.room + ' · ' + p.name + (isOut(p) ? ' (đã ra viện)' : '') : '—',
        site: x.site, who: x.who || 'Chưa phân công', hasNote: !!x.note, note: x.note,
        rowCls: x.done ? 'si si-done' : 'si', toggleLabel: x.done ? 'Hoàn tác' : 'Đã thực hiện',
        toggle: function () { self.setState({ scheds: self.state.scheds.map(function (y) { return y.id === x.id ? Object.assign({}, y, { done: !y.done }) : y; }) }); },
        remove: function () { self.setState({ scheds: self.state.scheds.filter(function (y) { return y.id !== x.id; }) }); }
      });
    });

    var nowD = new Date(k.now);
    var showOut = s.showOut;
    return {
      sysPanel: h(SysPanel, null), syncBadge: h(SyncBadge, null),
      sc: { s0: 'scene' + ((s.scene || 0) === 0 ? ' scene-on' : ''), s1: 'scene' + (s.scene === 1 ? ' scene-on' : ''), s2: 'scene' + (s.scene === 2 ? ' scene-on' : ''), s3: 'scene' + (s.scene === 3 ? ' scene-on' : '') },
      tabs: tabs, isDash: s.tab === 'dash', isBn: s.tab === 'bn', isGb: s.tab === 'gb', isTruc: s.tab === 'truc', isLich: s.tab === 'lich',
      nowLong: WDL[nowD.getDay()] + ', ' + dmy(k.now) + ' · ' + hm(k.now),
      nowShort: hm(k.now) + ' · ' + dmy(k.now),
      todayLong: WDL[nowD.getDay()] + ', ' + dmy(k.now),
      on: on, goBn: go('bn'), goLich: go('lich'),
      openAdmit: function () { self.setState(function (st) { return { modal: 'admit', err: '', now: Date.now(), editPid: null, form: st.editPid ? Object.assign({}, EMPTY_FORM) : st.form }; }); },
      admTitle: s.editPid ? 'Sửa thông tin bệnh nhân' : 'Khai báo nhập viện', admNew: !s.editPid, admEdit: !!s.editPid, editAt: s.editAt || '', admSave: s.editPid ? 'Lưu thay đổi' : 'Lưu nhập viện',
      closeModal: function () { self.setState(function (st) { return { modal: null, err: '', serr: '', editPid: null, form: st.editPid ? Object.assign({}, EMPTY_FORM) : st.form }; }); },
      modalAdmit: s.modal === 'admit', modalOrder: s.modal === 'order',

      bedsVal: beds, bedText: k.active.length + '/' + beds + ' giường', occPct: occ, occW: Math.min(100, occ),
      occColor: occ >= 90 ? '#C2410C' : '#0A8A76', freeBeds: Math.max(0, beds - k.active.length), capY: yv(beds),
      activeCount: k.active.length, inToday: inToday, outToday: outToday, in7: in7, out7: out7,
      procToday: k.todayP.length, procSplit: tiemToday + ' tiêm khớp · ' + (k.todayP.length - tiemToday) + ' điện cơ · ' + pendingToday + ' chờ',
      series: series, inPts: inPts, outPts: outPts, newCount: k.newIn.length, newList: newList, noNew: newList.length === 0,

      form: s.form, err: s.err, hasErr: !!s.err, q: s.q,
      submitPt: function (e) { self.addPatient(e); },
      cancelOut: function () { self.setState({ confirmId: null }); },
      showOut: showOut, showIn: !showOut,
      bnTitle: showOut ? 'Danh sách báo ra viện' : 'Bệnh nhân đang điều trị · ' + k.active.length,
      outBtnLabel: showOut ? '← Bệnh nhân hiện có' : 'Danh sách báo ra viện (' + outAll.length + ')',
      pendingCount: pendingCount, hasPending: pendingCount > 0,
      openOutList: function () { self.setState({ tab: 'bn', showOut: true, q: '' }); },
      outKinds: [['ra', 'Ra viện'], ['ck', 'Chuyển khoa'], ['cv', 'Chuyển viện']].map(function (x) { var cur = (s.oform && s.oform.kind) || 'ra'; return mk(x[1], cur === x[0], function () { self.setState({ oform: Object.assign({}, self.state.oform, { kind: x[0] }) }); }); }),
      outNotePh: ((s.oform && s.oform.kind) || 'ra') === 'ra' ? 'Tình trạng ra viện, đơn thuốc, hẹn tái khám…' : ((s.oform && s.oform.kind) === 'ck' ? 'Chuyển đến khoa nào, lý do chuyển…' : 'Chuyển đến bệnh viện nào, lý do chuyển…'),
      modalOut: s.modal === 'out', oform: s.oform || { time: '', note: '' }, oerr: s.oerr, hasOerr: !!s.oerr,
      outWho: op2 ? op2.room + ' · ' + op2.name + ' · ' + ageText(op2) + ' · vào ' + hm(op2.admitAt) + ' ' + dmy(op2.admitAt) : '',
      outReported: !!(op2 && op2.status === 'out'),
      on2: { oTime: this.setIn('oform', 'time'), oNote: this.setIn('oform', 'note'), oNow: function () { self.setState({ oform: Object.assign({}, self.state.oform, { time: dtLocal(Date.now()) }) }); } },
      submitOut: function (e) { self.saveDischarge(e); },
      cancelReport: function () { if (self.state.oform) self.cancelDischarge(self.state.oform.pid); },
      toggleOut: function () { self.setState({ showOut: !self.state.showOut, confirmId: null }); },
      newRows: newRows, noNewQ: newRows.length === 0, oldRows: oldRows, oldCount: k.active.length - k.newIn.length, noOldQ: oldRows.length === 0,
      outRows: outRows, outCount: outAll.length, noOutQ: outRows.length === 0,

      stats: stats, gbRows: gbRows, todayItems: todayItems, noTodayP: todayItems.length === 0, badItems: badItems, noBad: badItems.length === 0,
      copyGb: function () { self.copy('gb', self.gbText()); },
      copyGbLabel: s.copied === 'gb' ? 'Đã sao chép' : 'Sao chép văn bản báo cáo',
      copyFailGb: s.copied === 'fail:gb', gbText: s.copied === 'fail:gb' ? this.gbText() : '',

      dEvs: dc ? this.autoBlocks(dc.evs).map(function (b, i) { return { n: i + 1, name: b.name, room: b.room, notes: b.notes.map(function (t) { return { text: t }; }) }; }) : [],
      dEvCount: dc ? dc.evs.length : 0, noDEvs: !dc || !dc.evs.length,
      isDhst: s.tab === 'dhst', vdate: vd, vToday: function () { self.setState({ vdate: isoDay(Date.now()) }); }, vRoomChips: vRoomChips, vRooms: vRooms, noVRooms: !vRooms.length, vDayLabel: vDayLabel,
      openRecAny: function () { self.openRec(null, null); },
      modalRec: s.modal === 'rec' && !!rf, modalPt: s.modal === 'pt' && !!pp, pv: pv,
      rform: rf || {}, on3: on3, recPick: !!rf && !rf.locked, recPtChips: recPtChips,
      recWho: rp ? rp.room + ' · ' + rp.name + ' · ' + ageText(rp) : 'Chọn bệnh nhân',
      recTxOpen: !!(rf && rf.showTx), recTxClosed: !(rf && rf.showTx), rerr: s.rerr, hasRerr: !!s.rerr,
      submitRec: function (e) { self.saveRec(e); }, cancelRec: function () { self.cancelRec(); },
      txText: s.txText, cancelTx: function () { self.setState({ txFor: null, txText: '' }); },
      rv: rv, modalView: s.modal === 'view' && !!vr,
      dTransfers: dc ? transferRows(dc.transfers) : [], dTransferCount: dc ? dc.transfers.length : 0, noDTransfers: !dc || !dc.transfers.length,
      dAdmits: dc ? admitRows(dc.admits) : [], dAdmitCount: dc ? dc.admits.length : 0, noDAdmits: !dc || !dc.admits.length,
      isEditing: !!s.editingId, dTitle: s.editingId ? 'Sửa báo cáo trực' : 'Báo cáo trực', saveLabel: s.editingId ? 'Lưu thay đổi' : 'Lưu báo cáo trực',
      cancelEdit: function () { self.cancelEdit(); },
      duty: s.duty, dStats: dStats, dBlocks: dBlocks, dWindow: dc ? this.windowText(dc) : '',
      saveReport: function () { self.saveReport(); },
      derr: s.derr, hasDerr: !!s.derr, reports: reports, noReports: reports.length === 0,

      pk1: pk1, pk2: pk2,
      sform: sf, typeSeg: typeSeg, ptChips: ptChips, noActive: k.active.length === 0, siteChips: siteChips,
      orderLocked: s.orderLocked && !!op, orderPick: !(s.orderLocked && op),
      orderWho: op ? op.room + ' · ' + op.name + ' · ' + ageText(op) : '',
      openOrderAny: function () { self.openOrder(null); },
      siteLabel: sf.type === 'tiem' ? 'Vị trí khớp' : 'Vùng khảo sát',
      submitSched: function (e) { self.addSched(e); }, serr: s.serr, hasSerr: !!s.serr,
      filters: filters, groups: groups, noGroups: groups.length === 0
    };
  }
}

  var App = Component;

  /* ---------------- Đăng nhập ---------------- */
  class Login extends PComponent {
    constructor(p) { super(p); this.state = { pw: '', err: '', busy: false }; }
    async submit(e) {
      e.preventDefault();
      var pw = this.state.pw;
      if (!pw) { this.setState({ err: 'Nhập mật khẩu.' }); return; }
      this.setState({ busy: true, err: '' });
      var r = await sb.auth.signInWithPassword({ email: CFG.LOGIN_EMAIL, password: (CFG.PASSWORD_PREFIX || '') + pw });
      if (r.error) {
        var m = /invalid/i.test(r.error.message) ? 'Sai mật khẩu.' : 'Không đăng nhập được: ' + r.error.message;
        this.setState({ busy: false, err: m });
      } else { this.setState({ busy: false, pw: '' }); this.props.onOk(); }
    }
    render() {
      var s = this.state, self = this;
      return html`<div class="login-wrap">
        <form class="login" onSubmit=${function (e) { self.submit(e); }}>
          <div class="login-logo" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#E6F2EE" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5a2 2 0 1 0-2.5 2.5L9 10.5"></path><path d="M17 20.5a2 2 0 1 0 2.5-2.5L15 13.5"></path><circle cx="12" cy="12" r="2.6"></circle></svg></div>
          <h1>Đơn nguyên Cơ xương khớp</h1>
          <p class="muted">Nhập mật khẩu của đơn nguyên để vào</p>
          <label class="sr" for="lg-pw">Mật khẩu</label>
          <input id="lg-pw" class="in" type="password" autocomplete="current-password" placeholder="Mật khẩu" value=${s.pw} onInput=${function (e) { self.setState({ pw: e.target.value, err: '' }); }} autofocus />
          ${s.err ? html`<p class="err" role="alert">${s.err}</p>` : null}
          <button type="submit" class="btn" disabled=${s.busy}>${s.busy ? 'Đang vào…' : 'Vào'}</button>
        </form>
      </div>`;
    }
  }

  class Root extends PComponent {
    constructor(p) { super(p); this.state = { phase: 'loading', data: null, err: '' }; }
    componentDidMount() {
      var self = this;
      sb.auth.onAuthStateChange(function (ev) {
        if (ev === 'SIGNED_OUT') { SYNC.detach(); self.setState({ phase: 'login', data: null }); }
      });
      sb.auth.getSession().then(function (r) {
        if (r.data && r.data.session) self.load(); else self.setState({ phase: 'login' });
      });
    }
    async load() {
      this.setState({ phase: 'loading', err: '' });
      try {
        var data = await loadAll();
        SYNC.seed(data);
        this.setState({ phase: 'app', data: data });
      } catch (e) {
        console.error(e);
        this.setState({ phase: 'error', err: (e && e.message) || String(e) });
      }
    }
    render() {
      var s = this.state, self = this;
      if (s.phase === 'login') return html`<${Login} onOk=${function () { self.load(); }} />`;
      if (s.phase === 'error') return html`<div class="login-wrap"><div class="login"><h1>Không tải được dữ liệu</h1><p class="err">${s.err}</p><button class="btn" onClick=${function () { self.load(); }}>Thử lại</button><button class="btn-g" onClick=${function () { sb.auth.signOut(); }}>Đăng xuất</button></div></div>`;
      if (s.phase === 'loading') return html`<div class="login-wrap"><p class="muted">Đang tải dữ liệu…</p></div>`;
      return html`<${App} init=${s.data} />`;
    }
  }

  var rootEl = document.getElementById('root');
  rootEl.textContent = '';
  render(html`<${Root} />`, rootEl);
})();
