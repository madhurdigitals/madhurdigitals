window.CARD_TEMPLATES = window.CARD_TEMPLATES || {};

(function() {

  function t2NormalizeKey(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
  }

  function t2GetField(student, ...possibleKeys) {
    const studentKeys = Object.keys(student);
    for (const wanted of possibleKeys) {
      const match = studentKeys.find(k => t2NormalizeKey(k) === wanted);
      if (match && student[match]) return student[match];
    }
    return "";
  }

  window.CARD_TEMPLATES["template_2"] = {
    orientation: "portrait",
    photoShape: "circle",   // "circle" | "square" | "rounded"

    renderFront: function(student, schoolInfo, options) {
      const s = student;
      const schoolCode = options.schoolCode || "";
      const shapeClass = "t2-photo-" + (this.photoShape || "circle");

      const classSection = s.Section ? `${s.Class}-${s.Section}` : (s.Class || "");
      const dob     = t2GetField(s, "dob");
      const father  = t2GetField(s, "father_s_name", "fathers_name", "father_name");
      const phone   = t2GetField(s, "phone", "contact", "mobile");
      const address = t2GetField(s, "address");

      const photo = s["Photo_Link"]
        ? `<img class="t2-photo-img" src="${getPhotoUrl(s['Photo_Link'], 'w_200,h_200,c_fill')}">`
        : `<div class="t2-photo-placeholder">No Photo</div>`;

      return `
        <div class="t2-front">
          <div class="t2-header">
            <div class="t2-school-name">${schoolInfo.school_name || schoolCode}</div>
          </div>

          <div class="t2-photo-wrap ${shapeClass}">
            ${photo}
          </div>

          <div class="t2-body">
            <div class="t2-name">${s.Name || ""}</div>
            <div class="t2-class">Class: ${classSection}</div>

            <div class="t2-details">
              ${dob     ? `<div class="t2-line"><span>DOB:</span> ${dob}</div>` : ""}
              ${father  ? `<div class="t2-line"><span>Father:</span> ${father}</div>` : ""}
              ${phone   ? `<div class="t2-line"><span>Phone:</span> ${phone}</div>` : ""}
              ${address ? `<div class="t2-line"><span>Address:</span> ${address}</div>` : ""}
            </div>
          </div>
        </div>
      `;
    },

    renderBack: function(schoolInfo) {
      return `
        <div class="t2-back">
          <div class="t2-back-title">INSTRUCTIONS</div>
          <ul class="t2-back-list">
            <li>This card is the property of ${schoolInfo.school_name || ""}.</li>
            <li>This card is non-transferable.</li>
            <li>Report loss of card immediately.</li>
            <li>This card must be worn within the school premises.</li>
            <li>Return this card when leaving the school.</li>
          </ul>
          <div class="t2-back-footer">
            <div>${schoolInfo.school_name || ""}</div>
            <div>${schoolInfo.address || ""}</div>
            <div>${schoolInfo.contact || ""}</div>
          </div>
        </div>
      `;
    }
  };

})();