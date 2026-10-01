window.CARD_TEMPLATES = window.CARD_TEMPLATES || {};

(function() {

  function t3NormalizeKey(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
  }

  function t3GetField(student, ...possibleKeys) {
    const studentKeys = Object.keys(student);
    for (const wanted of possibleKeys) {
      const match = studentKeys.find(k => t3NormalizeKey(k) === wanted);
      if (match && student[match]) return student[match];
    }
    return "";
  }

  // Dummy QR — static placeholder pattern, not a real generated code
  const DUMMY_QR_SVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 29 29'><rect width='29' height='29' fill='%23fff'/><path fill='%23000' d='M0 0h7v7H0zM9 0h1v1H9zM12 0h2v1h-2zM16 0h1v1h-1zM22 0h7v7h-7zM2 2v3h3V2zM24 2v3h3V2zM9 4h2v2H9zM14 4h1v2h-1zM17 4h1v1h-1zM0 9h1v1H0zM3 9h2v1H3zM7 9h1v1H7zM10 9h3v1h-3zM15 9h1v1h-1zM18 9h2v1h-2zM22 9h1v1h-1zM24 9h2v1h-2zM27 9h1v1h-1zM1 11h1v2H1zM4 11h1v1H4zM8 11h2v1H8zM12 11h1v1h-1zM16 11h2v1h-2zM20 11h1v1h-1zM23 11h2v1h-2zM26 11h2v1h-2zM0 14h2v1H0zM5 14h1v1H5zM9 14h1v1H9zM13 14h2v1h-2zM19 14h2v1h-2zM24 14h2v1h-2zM2 16h2v1H2zM7 16h1v1H7zM11 16h2v1h-2zM17 16h1v1h-1zM21 16h1v1h-1zM25 16h2v1h-2zM0 18h1v1H0zM4 18h2v1H4zM9 18h1v1H9zM14 18h2v1h-2zM20 18h1v1h-1zM22 18h5v5h-5zM0 22h7v7H0zM2 24v3h3v-3z'/></svg>`;

  window.CARD_TEMPLATES["template_3"] = {

    orientation: "portrait",   // Cosmopolitan style — CR80 portrait card

    renderFront: function(student, schoolInfo, options) {
      const s = student;
      const schoolCode = options.schoolCode || "";

      const classSection = s.Section ? `${s.Class} - ${s.Section}` : (s.Class || "");
      const dob     = t3GetField(s, "dob");
      const father  = t3GetField(s, "father_s_name", "fathers_name", "father_name");
      const phone   = t3GetField(s, "phone", "contact", "mobile");
      const address = t3GetField(s, "address");

      const photo = s["Photo_Link"]
        ? `<img class="t3-photo-img" src="${getPhotoUrl(s['Photo_Link'], 'w_200,h_200,c_fill')}">`
        : `<div class="t3-photo-placeholder">👤</div>`;

      return `
        <div class="t3-front">

          <div class="t3-header">
            <div class="t3-logo">🎓</div>
            <div class="t3-header-text">
              <div class="t3-school-name">${schoolInfo.school_name || schoolCode}</div>
              <div class="t3-school-address">📍 ${schoolInfo.address || ""}</div>
            </div>
          </div>

          <div class="t3-photo-wrap">
            ${photo}
          </div>

          <div class="t3-name-band">
            <div class="t3-name">${s.Name || ""}</div>
            <div class="t3-class">CLASS : ${classSection}</div>
          </div>

          <div class="t3-details">
            ${father  ? `<div class="t3-line"><span class="t3-icon">👨</span><span class="t3-label">FATHER'S NAME</span><span class="t3-colon">:</span><span class="t3-value">${father}</span></div>` : ""}
            ${dob     ? `<div class="t3-line"><span class="t3-icon">📅</span><span class="t3-label">DATE OF BIRTH</span><span class="t3-colon">:</span><span class="t3-value">${dob}</span></div>` : ""}
            ${address ? `<div class="t3-line"><span class="t3-icon">📍</span><span class="t3-label">ADDRESS</span><span class="t3-colon">:</span><span class="t3-value">${address}</span></div>` : ""}
            ${phone   ? `<div class="t3-line"><span class="t3-icon">📞</span><span class="t3-label">MOBILE NO.</span><span class="t3-colon">:</span><span class="t3-value">${phone}</span></div>` : ""}
          </div>

          <div class="t3-footer">
            <div class="t3-session">
              <div class="t3-session-label">SESSION</div>
              <div class="t3-session-value">2026-2027</div>
            </div>
            <img class="t3-qr" src="${DUMMY_QR_SVG}">
            <div class="t3-signature">
              <div class="t3-sig-line">✒️</div>
              <div class="t3-sig-label">Principal</div>
            </div>
          </div>

          <div class="t3-bottom-bar">
            <span>📞 ${schoolInfo.contact || ""}</span>
          </div>

        </div>
      `;
    },

    renderBack: function(schoolInfo) {
      return `
        <div class="t3-back">

          <div class="t3-back-emblem">🎓</div>
          <div class="t3-back-tagline">Excellence in Education</div>
          <div class="t3-back-stars">★ ★ ★</div>

          <div class="t3-back-title-wrap">
            <div class="t3-back-title">INSTRUCTIONS</div>
          </div>

          <div class="t3-back-list">
            <div class="t3-back-item"><span class="t3-back-icon">🛡️</span><span>This card is the property of ${schoolInfo.school_name || "the school"}.</span></div>
            <div class="t3-back-item"><span class="t3-back-icon">🆔</span><span>This card is non-transferable.</span></div>
            <div class="t3-back-item"><span class="t3-back-icon">⚠️</span><span>Report loss of card immediately.</span></div>
            <div class="t3-back-item"><span class="t3-back-icon">👤</span><span>This card must be worn within the school premises.</span></div>
            <div class="t3-back-item"><span class="t3-back-icon">↩️</span><span>Return this card when leaving the school.</span></div>
          </div>

          <div class="t3-back-footer">
            <div class="t3-back-school-name">✦ ${schoolInfo.school_name || ""} ✦</div>
            <div class="t3-back-meta">📍 ${schoolInfo.address || ""}</div>
            <div class="t3-back-meta">📞 ${schoolInfo.contact || ""} &nbsp; 🌐 www.${(schoolInfo.school_name || "school").toLowerCase().replace(/[^a-z0-9]/g,"")}.in</div>
          </div>

        </div>
      `;
    }
  };

})();