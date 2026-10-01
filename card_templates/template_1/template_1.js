window.CARD_TEMPLATES = window.CARD_TEMPLATES || {};

window.CARD_TEMPLATES["template_1"] = {
  orientation: "landscape",

  renderFront: function(student, schoolInfo, options) {
    const s = student;
    const selectedFields = options.selectedFields || [];
    const schoolCode = options.schoolCode || "";

    const photo = s["Photo_Link"]
      ? `<img class="photo-box" src="${getPhotoUrl(s['Photo_Link'], 'w_150,h_150,c_fill')}">`
      : `<div class="photo-box"></div>`;

    const fieldsHtml = selectedFields.map((f, i) => {
      if (i === 0) return `<div class="name">${s[f] || ""}</div>`;

      if (f === "Class" && selectedFields.includes("Section")) {
        const cls = s.Class || "";
        const sec = s.Section || "";
        let value = "";
        if (cls && sec) value = `${cls} - ${sec}`;
        else if (cls) value = cls;
        else if (sec) value = sec;
        return `<div class="line"><span>Class:</span> ${value}</div>`;
      }

      if (f === "Section" && selectedFields.includes("Class")) return "";

      return `<div class="line"><span>${f}:</span> ${s[f] || ""}</div>`;
    }).join("");

    return `
      <div class="card-header">
        <div class="school-name">${schoolInfo.school_name || schoolCode}</div>
        <div class="school-meta">${schoolInfo.address || ""}</div>
        <div class="school-meta">${schoolInfo.contact || ""}</div>
      </div>
      <div class="card-body">
        <div class="left">${photo}</div>
        <div class="right">${fieldsHtml}</div>
      </div>
    `;
  },

  renderBack: null   // Template 1 has no back design
};