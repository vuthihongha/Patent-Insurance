/*
 * "Trợ lý đề tài": an offline Q&A assistant built from the research content.
 * Retrieval runs entirely in the browser (diacritic-insensitive token + bigram scoring),
 * so it works on any host and in the static share link; answers link to the right page.
 * Designed so a real LLM backend can later replace `answer()` (POST /api/assistant).
 */
(function () {
  'use strict';
  var lang = (document.documentElement.lang || 'vi').slice(0, 2) === 'en' ? 'en' : 'vi';

  // page links, read from the footer (keeps working after the static export rewrites hrefs)
  var KEYS = ['about', 'insurance', 'strategy', 'international', 'legal', 'tool', 'experts', 'library'];
  var LINKS = {};
  var fl = document.querySelectorAll('.footer-links a');
  KEYS.forEach(function (k, i) { if (fl[i]) LINKS[k] = fl[i].getAttribute('href'); });

  var T = {
    vi: {
      open: 'Hỏi trợ lý đề tài', title: 'Trợ lý đề tài', sub: 'Trả lời theo nội dung nghiên cứu',
      hello: 'Xin chào! Tôi là trợ lý của đề tài <b>Chiến lược Bảo hiểm Sáng chế</b>. Bạn có thể hỏi về bảo hiểm sáng chế, 03 sản phẩm đề xuất, lộ trình, kinh nghiệm quốc tế hoặc khung pháp lý.',
      placeholder: 'Nhập câu hỏi…', send: 'Gửi', close: 'Đóng', more: 'Xem thêm',
      fallback: 'Tôi chưa tìm thấy nội dung khớp trong đề tài. Bạn thử hỏi theo một trong các gợi ý dưới đây, hoặc dùng <a href="{tool}">công cụ tự đánh giá</a> để biết doanh nghiệp phù hợp loại bảo hiểm nào.',
      note: 'Thông tin mang tính tham khảo, trích từ nội dung đề tài; không thay thế tư vấn pháp lý.',
      chips: ['Bảo hiểm sáng chế là gì?', 'Đã mua được ở Việt Nam chưa?', 'Có mấy sản phẩm đề xuất?', 'Phí bảo hiểm bao nhiêu?', 'Doanh nghiệp nhỏ có tham gia được không?', 'Trung Quốc làm thế nào?']
    },
    en: {
      open: 'Ask the research assistant', title: 'Research assistant', sub: 'Answers drawn from the study',
      hello: 'Hello! I am the assistant for the <b>Patent Insurance Strategy</b> study. Ask about patent insurance, the 3 proposed products, the roadmap, international models or the legal framework.',
      placeholder: 'Type a question…', send: 'Send', close: 'Close', more: 'Read more',
      fallback: 'I could not find a matching answer in the study. Try one of the suggestions below, or use the <a href="{tool}">self-assessment tool</a> to see which cover fits your business.',
      note: 'For reference only, drawn from the study; not legal advice.',
      chips: ['What is patent insurance?', 'Can I buy it in Vietnam yet?', 'Which products are proposed?', 'How much does it cost?', 'Can small businesses join?', 'How does China do it?']
    }
  }[lang];

  // ---------------- knowledge base (from the study's content) ----------------
  var KB = {
    vi: [
      { k: 'bao hiem sang che la gi khai niem dinh nghia', a: 'Bảo hiểm sáng chế là loại <b>bảo hiểm phi nhân thọ</b>, xác lập bằng hợp đồng. Doanh nghiệp bảo hiểm cùng gánh rủi ro pháp lý của sáng chế, chủ yếu là <b>rủi ro xâm phạm</b>: chi trả chi phí giải quyết tranh chấp khi bị kiện hoặc khi khởi kiện bảo vệ quyền.', l: 'insurance' },
      { k: 'khac bao hiem thong thuong dac diem tai san vo hinh', a: 'Khác bảo hiểm thông thường ở chỗ đối tượng là <b>tài sản vô hình</b>, rủi ro mang tính kỹ thuật cao, khó định lượng và định phí. Bảo hiểm tập trung vào <b>chi phí giải quyết tranh chấp</b> thay vì khôi phục tài sản.', l: 'insurance' },
      { k: 'da mua duoc chua viet nam hien nay co san pham thi truong', a: '<b>Chưa.</b> Thị trường Việt Nam chưa có sản phẩm bảo hiểm chuyên biệt cho sáng chế và pháp luật chưa có quy định riêng. Đề tài đề xuất lộ trình để hình thành thị trường này.', l: 'legal' },
      { k: 'may san pham de xuat 03 ba san pham loai nao cap phep chi phi phap ly thuc thi trach nhiem xam pham', a: 'Đề tài đề xuất <b>03 sản phẩm</b>: (1) <b>Bảo hiểm cấp phép</b>, cho rủi ro đơn không được cấp văn bằng; (2) <b>Bảo hiểm chi phí pháp lý (thực thi quyền)</b>, chi trả luật sư và tố tụng khi khởi kiện hoặc bị kiện; (3) <b>Bảo hiểm trách nhiệm xâm phạm</b>, khi bị bên thứ ba cáo buộc xâm phạm (giai đoạn 3).', l: 'insurance' },
      { k: 'phi bao hiem bao nhieu gia chi phi muc phi', a: 'Việt Nam <b>chưa có biểu phí</b>. Tại Hoa Kỳ, phí thường từ <b>1% đến 5%</b> giá trị được bảo hiểm. Đề tài đề xuất Nhà nước <b>hỗ trợ một phần phí</b> trong giai đoạn thí điểm.', l: 'international' },
      { k: 'doanh nghiep nho vua sme tham gia duoc khong dieu kien doi tuong', a: '<b>Được.</b> Đề tài đề xuất sàng lọc theo <b>năng lực công nghệ và hoạt động đổi mới sáng tạo</b>, không theo quy mô. Nghị định 268/2025/NĐ-CP đã mở rộng tư cách doanh nghiệp KH&CN theo tiêu chí đổi mới sáng tạo.', l: 'strategy' },
      { k: 'co y xam pham gian lan chi tra loai tru ran de', a: '<b>Không.</b> Hành vi cố ý xâm phạm và gian lận bị loại trừ, nên bảo hiểm không làm giảm tính răn đe của pháp luật sở hữu trí tuệ.', l: 'insurance' },
      { k: 'khi nao nen tham gia thoi diem mua luc nao', a: 'Bảo hiểm cấp phép phù hợp <b>từ khi nộp đơn</b>. Với các sản phẩm còn lại, đề tài đề xuất tham gia <b>ngay khi được cấp bằng</b>, lúc chưa phát sinh nguy cơ kiện tụng cụ thể.', l: 'insurance' },
      { k: 'bat buoc tu nguyen co phai mua', a: '<b>Không bắt buộc.</b> Đề tài đề xuất cơ chế tự nguyện có hỗ trợ của Nhà nước; chỉ khi thị trường đủ lớn mới cân nhắc bán bắt buộc với một số ngành rủi ro cao.', l: 'legal' },
      { k: 'rui ro sang che giai doan truoc sau cap bang khai thac', a: 'Rủi ro có mặt ở mọi giai đoạn: <b>trước khi cấp bằng</b> (đơn bị từ chối), <b>sau khi cấp bằng</b> (văn bằng có thể bị hủy bỏ, vô hiệu), <b>trong khai thác</b> (bị kiện hoặc bị xâm phạm), và cả <b>sau khi hết hiệu lực</b>.', l: 'insurance' },
      { k: 'chien luoc lo trinh tru cot giai doan 5 tru cot 3 giai doan', a: 'Chiến lược gồm <b>5 trụ cột, 3 giai đoạn</b>: lộ trình sản phẩm, thí điểm có kiểm soát, hạ tầng, tài chính, giám sát & KPI. Giai đoạn 1 <b>khởi động</b> với bảo hiểm cấp phép và thực thi quyền; giai đoạn 2 <b>củng cố</b>; giai đoạn 3 <b>phát triển chiều sâu</b> (trách nhiệm xâm phạm, bảo lãnh vay thế chấp bằng sáng chế).', l: 'strategy' },
      { k: 'thi diem dia ban ha noi tp hcm ho chi minh o dau', a: 'Đề tài đề xuất <b>thí điểm có kiểm soát</b> với doanh nghiệp KH&CN, công nghệ cao có hoạt động R&D và sở hữu sáng chế, tại các địa bàn có nguồn lực như <b>Hà Nội</b> và <b>TP. Hồ Chí Minh</b>. Khu vực tư nhân thiết kế sản phẩm; Nhà nước hỗ trợ qua đồng bảo hiểm, tái bảo hiểm.', l: 'strategy' },
      { k: 'nghich ly thuong mai hoa ty le so lieu tang 36 0 1', a: 'Nghịch lý: đơn sáng chế của chủ thể Việt Nam <b>tăng 36% năm 2025</b>, nhưng tỷ lệ sáng chế được thương mại hóa chỉ khoảng <b>0,1%</b>, thấp hơn trung bình toàn cầu (5%) khoảng 50 lần. Mục tiêu năm 2030 là 8–10%.', l: 'about' },
      { k: 'trung quoc china mo hinh bac kinh picc', a: '<b>Trung Quốc</b>: Nhà nước định hướng, thị trường vận hành, địa phương thí điểm. Từ sản phẩm đầu tiên ở Phật Sơn (2010), PICC thí điểm tại 27 thành phố; Bắc Kinh có <b>4.818 sáng chế</b> được bảo hiểm, <b>472 doanh nghiệp</b> được hỗ trợ phí.', l: 'international' },
      { k: 'hoa ky my usa mo hinh thi truong', a: '<b>Hoa Kỳ</b>: thị trường thuần túy, hợp đồng phức tạp, phí cao (<b>1–5%</b> giá trị bảo hiểm). Hình thành từ khoảng năm 1985; IPISC tiên phong năm 1987.', l: 'international' },
      { k: 'nhat ban japan jpo ho tro phi', a: '<b>Nhật Bản</b>: Nhà nước hỗ trợ có mục tiêu; từ năm 2016 JPO hỗ trợ <b>một nửa phí bảo hiểm</b> cho doanh nghiệp vừa và nhỏ.', l: 'international' },
      { k: 'kinh nghiem quoc te bai hoc viet nam mo hinh nao phu hop eu chau au', a: 'Đề tài so sánh 4 mô hình (Trung Quốc, Nhật Bản, EU, Hoa Kỳ), từ Nhà nước dẫn dắt đến thị trường tự vận hành. Đề xuất cho Việt Nam: <b>Nhà nước khởi xướng, hỗ trợ có điều kiện, rồi rút dần</b>.', l: 'international' },
      { k: 'phap ly khung phap luat rao can kien nghi luat', a: 'Bảo hiểm sáng chế nằm giữa <b>6 lĩnh vực pháp luật</b>. Rào cản chính: chưa có cơ chế chia sẻ rủi ro cho sáng chế, thị trường trung gian yếu, dữ liệu phân tán, năng lực còn hạn chế và giá trị sáng chế khó định lượng. Đề tài kiến nghị hoàn thiện 5 lĩnh vực, trong đó có định giá sáng chế theo chuẩn <b>IVS 210</b>.', l: 'legal' },
      { k: 'dinh gia sang che ivs 210 the chap vay von', a: 'Đề tài kiến nghị hướng dẫn <b>định giá sáng chế theo chuẩn IVS 210</b>, làm nền cho bảo lãnh khoản vay thế chấp bằng sáng chế và tài chính hóa tài sản trí tuệ ở giai đoạn 3.', l: 'legal' },
      { k: 'cong cu tu danh gia doanh nghiep can loai nao phu hop', a: 'Hãy dùng <b>công cụ tự đánh giá</b>: trả lời 8 câu hỏi ngắn về lĩnh vực, tình trạng sáng chế và hoạt động của doanh nghiệp để biết loại bảo hiểm phù hợp.', l: 'tool' },
      { k: 'tac gia nguoi huong dan de tai truong ai lam', a: 'Đề tài nghiên cứu khoa học sinh viên năm 2026 của <b>CN. Vũ Thị Hồng Hà</b>, người hướng dẫn <b>ThS. Đỗ Tiến Đạt</b>, Trường Đại học Luật Hà Nội.', l: 'about' },
      { k: 'chuyen gia phong van y kien', a: 'Đề tài có phần <b>góc chuyên gia</b>, tổng hợp ý kiến phỏng vấn về nhu cầu và điều kiện hình thành bảo hiểm sáng chế.', l: 'experts' },
      { k: 'tai lieu van ban thu vien nguon tham khao', a: 'Các văn bản pháp luật và tài liệu tham khảo của đề tài được tập hợp trong <b>thư viện</b>.', l: 'library' }
    ],
    en: [
      { k: 'what is patent insurance definition', a: 'Patent insurance is <b>non-life insurance</b> set up by contract. The insurer shares the legal risk of a patent, mainly <b>infringement risk</b>: it pays dispute costs when you are sued or when you sue to enforce your rights.', l: 'insurance' },
      { k: 'different from ordinary insurance intangible', a: 'It covers an <b>intangible asset</b> whose risk is technical and hard to quantify and price, and it pays <b>dispute costs</b> rather than restoring property.', l: 'insurance' },
      { k: 'buy vietnam available yet market exist', a: '<b>Not yet.</b> Vietnam has no dedicated patent insurance product and no specific legal rules for it. The study proposes a roadmap to create this market.', l: 'legal' },
      { k: 'products proposed three which licensing legal expenses enforcement liability infringement', a: 'The study proposes <b>3 products</b>: (1) <b>licensing (grant) insurance</b> for applications that are refused; (2) <b>legal expenses (enforcement) insurance</b> for lawyers and litigation; (3) <b>infringement liability insurance</b> when a third party alleges infringement (phase 3).', l: 'insurance' },
      { k: 'cost price premium how much', a: 'Vietnam has <b>no tariff yet</b>. In the United States premiums are typically <b>1–5%</b> of the insured value. The study proposes <b>partial state premium support</b> during the pilot.', l: 'international' },
      { k: 'small business sme join eligible', a: '<b>Yes.</b> Screening is by <b>technological and innovation capacity</b>, not by size. Decree 268/2025/ND-CP widened science-and-technology enterprise status on innovation criteria.', l: 'strategy' },
      { k: 'wilful intentional infringement fraud covered excluded', a: '<b>No.</b> Wilful infringement and fraud are excluded, so insurance does not weaken the deterrent effect of IP law.', l: 'insurance' },
      { k: 'when should join timing', a: 'Licensing insurance fits <b>from filing</b>. For the other products, the study suggests joining <b>as soon as the patent is granted</b>, before any concrete litigation risk arises.', l: 'insurance' },
      { k: 'mandatory compulsory voluntary', a: '<b>Not mandatory.</b> A voluntary scheme with state support; compulsory cover would only be considered for some high-risk sectors once the market is large enough.', l: 'legal' },
      { k: 'strategy roadmap pillars phases', a: 'The strategy has <b>5 pillars and 3 phases</b>: product roadmap, controlled pilot, infrastructure, finance, monitoring & KPIs. Phase 1 <b>launches</b> licensing and enforcement cover; phase 2 <b>consolidates</b>; phase 3 <b>deepens</b> (infringement liability, patent-backed loan guarantees).', l: 'strategy' },
      { k: 'paradox commercialisation rate statistics 36 0.1', a: 'Patent filings by Vietnamese applicants <b>rose 36% in 2025</b>, yet only about <b>0.1%</b> of patents are commercialised, roughly 50 times below the global average (5%). The 2030 target is 8–10%.', l: 'about' },
      { k: 'china model beijing picc', a: '<b>China</b>: state-guided, market-run, locally piloted. Beijing insured <b>4,818 patents</b> and subsidised premiums for <b>472 firms</b>.', l: 'international' },
      { k: 'united states usa america model', a: '<b>United States</b>: a pure market, complex contracts, high premiums (<b>1–5%</b> of insured value); pioneered by IPISC in 1987.', l: 'international' },
      { k: 'japan jpo subsidy', a: '<b>Japan</b>: targeted state support; since 2016 the JPO has covered <b>half the premium</b> for SMEs.', l: 'international' },
      { k: 'international lessons vietnam which model eu europe', a: 'Four models are compared (China, Japan, EU, US). For Vietnam the study proposes: <b>the state initiates, supports conditionally, then steps back</b>.', l: 'international' },
      { k: 'legal framework law barriers recommendations', a: 'Patent insurance sits across <b>6 areas of law</b>. The study recommends reforms in 5 areas, including patent valuation under <b>IVS 210</b>.', l: 'legal' },
      { k: 'self assessment tool which cover fits my business', a: 'Try the <b>self-assessment tool</b>: 8 short questions about your field, patent status and activity show which cover fits.', l: 'tool' },
      { k: 'author supervisor who university', a: 'A 2026 student research project by <b>Vu Thi Hong Ha (LL.B.)</b>, supervised by <b>Do Tien Dat (LL.M.)</b>, Hanoi Law University.', l: 'about' }
    ]
  }[lang];

  // ---------------- retrieval ----------------
  function norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9%.,\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var STOP = { la: 1, gi: 1, co: 1, khong: 1, the: 1, nao: 1, cua: 1, va: 1, cho: 1, duoc: 1, toi: 1, ban: 1, a: 1, an: 1, is: 1, of: 1, to: 1, it: 1, do: 1, does: 1, how: 1, what: 1, i: 1, my: 1, in: 1, for: 1, can: 1 };
  function grams(s) {
    var w = norm(s).split(' ').filter(function (x) { return x && !STOP[x]; });
    var g = w.slice();
    for (var i = 0; i < w.length - 1; i++) g.push(w[i] + '_' + w[i + 1]);
    return g;
  }
  KB.forEach(function (e) { e.g = grams(e.k + ' ' + e.a.replace(/<[^>]+>/g, ' ')); e.kg = grams(e.k); });
  function answer(q) {
    var qg = grams(q); if (!qg.length) return null;
    var best = null, bs = 0;
    KB.forEach(function (e) {
      var s = 0;
      qg.forEach(function (t) { var bi = t.indexOf('_') > 0 ? 2 : 1; if (e.kg.indexOf(t) >= 0) s += 2 * bi; else if (e.g.indexOf(t) >= 0) s += 0.6 * bi; });
      s /= Math.sqrt(qg.length + 1);
      if (s > bs) { bs = s; best = e; }
    });
    return bs >= 1.1 ? best : null;
  }

  // ---------------- UI ----------------
  var root = document.createElement('div');
  root.className = 'asst';
  root.innerHTML =
    '<button class="asst-fab" type="button" aria-expanded="false" aria-controls="asst-panel">' +
      '<span class="asst-fab-dot" aria-hidden="true"></span><span class="asst-fab-label">' + T.open + '</span></button>' +
    '<section class="asst-panel" id="asst-panel" role="dialog" aria-label="' + T.title + '" hidden>' +
      '<header class="asst-head"><img src="/images/mark.svg" alt="" width="30" height="30"><div><p class="asst-title">' + T.title + '</p><p class="asst-sub">' + T.sub + '</p></div>' +
        '<button class="asst-close" type="button" aria-label="' + T.close + '">&times;</button></header>' +
      '<div class="asst-log" aria-live="polite"></div>' +
      '<div class="asst-chips"></div>' +
      '<form class="asst-form"><input class="asst-input" type="text" autocomplete="off" maxlength="200" placeholder="' + T.placeholder + '" aria-label="' + T.placeholder + '">' +
        '<button class="asst-send" type="submit" aria-label="' + T.send + '"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></form>' +
      '<p class="asst-note">' + T.note + '</p>' +
    '</section>';
  document.body.appendChild(root);
  var fab = root.querySelector('.asst-fab'), panel = root.querySelector('.asst-panel'), log = root.querySelector('.asst-log');
  var input = root.querySelector('.asst-input'), chips = root.querySelector('.asst-chips');
  // the page's own mark image may be inlined as a data URI in the static export
  var mark = document.querySelector('.brand img'); if (mark) root.querySelector('.asst-head img').src = mark.getAttribute('src');

  function msg(html, who) {
    var d = document.createElement('div'); d.className = 'asst-msg asst-' + who; d.innerHTML = html;
    log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  function text(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function reply(q) {
    msg(text(q), 'me');
    var typing = msg('<span class="asst-typing"><i></i><i></i><i></i></span>', 'bot');
    setTimeout(function () {
      typing.remove();
      var e = answer(q);
      if (e) msg(e.a + (LINKS[e.l] ? ' <a class="asst-more" href="' + LINKS[e.l] + '">' + T.more + ' →</a>' : ''), 'bot');
      else msg(T.fallback.replace('{tool}', LINKS.tool || '#'), 'bot');
    }, 420);
  }
  T.chips.forEach(function (c) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'asst-chip'; b.textContent = c;
    b.addEventListener('click', function () { reply(c); });
    chips.appendChild(b);
  });
  var greeted = false;
  function open(v) {
    panel.hidden = !v; fab.setAttribute('aria-expanded', v ? 'true' : 'false'); root.classList.toggle('is-open', v);
    if (v) { if (!greeted) { msg(T.hello, 'bot'); greeted = true; } setTimeout(function () { input.focus(); }, 60); }
  }
  fab.addEventListener('click', function () { open(panel.hidden); });
  root.querySelector('.asst-close').addEventListener('click', function () { open(false); fab.focus(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { open(false); fab.focus(); } });
  root.querySelector('.asst-form').addEventListener('submit', function (e) {
    e.preventDefault(); var q = input.value.trim(); if (!q) return; input.value = ''; reply(q);
  });
})();
