/* =============================================
   custom_template_renderer.js
   - Generic engine: takes a layout JSON (background + field positions)
     and renders it for any student, on any school.
   - Field data binding is fully dynamic — works with whatever columns
     a school actually has, same normalization pattern as templates 2-4.
   - Supports 9-point alignment (H + V) and an "image" field type for
     uploaded logos/signatures, in addition to text/photo/static/qr/signature.
   ============================================= */

function ctrNormalizeKey(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
}

function ctrGetField(student, dataFieldKey) {
  if (!dataFieldKey) return "";
  const wanted = ctrNormalizeKey(dataFieldKey);
  const studentKeys = Object.keys(student);
  const match = studentKeys.find(k => ctrNormalizeKey(k) === wanted);
  return match ? (student[match] || "") : "";
}

/**
 * Renders one side (front or back) of a custom template as an HTML string.
 *
 * @param {Object} sideLayout - { width_mm, height_mm, fields: [...] }
 * @param {Object} student    - student data row (or {} for a static/back side)
 * @param {Object} schoolInfo - school data row
 * @param {String} backgroundUrl - resolved Cloudinary URL for the background image
 */
function renderCustomTemplateSide(sideLayout, student, schoolInfo, backgroundUrl) {
  if (!sideLayout) return "";

  const vAlignMap = { top: "flex-start", middle: "center", bottom: "flex-end" };
  const hAlignMap = { left: "flex-start", center: "center", right: "flex-end" };

  const fieldsHtml = (sideLayout.fields || []).map(field => {

    const commonStyle = `
      position:absolute;
      left:${field.x}mm; top:${field.y}mm;
      width:${field.width}mm; height:${field.height}mm;
      transform:rotate(${field.rotation || 0}deg);
      display:flex;
      align-items:${vAlignMap[field.valign] || "center"};
      justify-content:${hAlignMap[field.align] || "center"};
    `;

    if (field.type === "photo") {
      const photoUrl = student["Photo_Link"] ? getPhotoUrl(student["Photo_Link"], `w_300,h_300,c_fill`) : "";
      const shapeStyle = field.shape === "circle" ? "border-radius:50%;" : field.shape === "rounded" ? "border-radius:2mm;" : "";
      return `
        <div style="${commonStyle} overflow:hidden; ${shapeStyle} background:#f1f5f9;">
          ${photoUrl ? `<img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:2mm;color:#94a3b8;">Photo</span>`}
        </div>
      `;
    }

    if (field.type === "image") {
      const imgUrl = field.imageLink ? getPhotoUrl(field.imageLink.split("|")[0], "w_400") : "";
      const shapeStyle = field.shape === "circle" ? "border-radius:50%;" : field.shape === "rounded" ? "border-radius:2mm;" : "";
      return `
        <div style="${commonStyle} overflow:hidden; ${shapeStyle}">
          ${imgUrl ? `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:contain;">` : ""}
        </div>
      `;
    }

    if (field.type === "signature") {
      // Placeholder for now — use an "image" field instead if you want a real uploaded signature
      return `
        <div style="${commonStyle} font-size:${field.fontSize || 3}mm; font-style:italic; color:#94a3b8;">
          Signature
        </div>
      `;
    }

    if (field.type === "qr") {
      // Dummy QR placeholder
      return `
        <div style="${commonStyle} background:#fff; border:0.2mm solid #ccc;">
          <span style="font-size:1.8mm; color:#94a3b8;">QR</span>
        </div>
      `;
    }

    if (field.type === "static") {
      const textStyle = `font-family:${field.font || "Arial"}; font-size:${field.fontSize || 3}mm; font-weight:${field.bold ? 700 : 400}; color:${field.color || "#000"}; text-align:${field.align || "center"};`;
      return `<div style="${commonStyle} ${textStyle}">${field.text || ""}</div>`;
    }

    // Default: "text" — bound to a real data field (student or school)
    let value = "";
    if (field.source === "school") {
      value = schoolInfo[field.dataField] || "";
    } else {
      value = ctrGetField(student, field.dataField);
    }

    // Special case: merged Class-Section
    if (field.dataField === "class_section") {
      const cls = student.Class || "";
      const sec = student.Section || "";
      value = sec ? `${cls} - ${sec}` : cls;
    }

    const textStyle = `font-family:${field.font || "Arial"}; font-size:${field.fontSize || 3}mm; font-weight:${field.bold ? 700 : 400}; color:${field.color || "#000"}; text-align:${field.align || "center"};`;
    const prefix = field.label ? `<span style="font-weight:600;margin-right:1mm;">${field.label}</span>` : "";

    return `<div style="${commonStyle} ${textStyle} overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${prefix}${value}</div>`;

  }).join("");

  return `
    <div style="position:relative; width:${sideLayout.width_mm}mm; height:${sideLayout.height_mm}mm; overflow:hidden;">
      ${backgroundUrl ? `<img src="${backgroundUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover;">` : ""}
      ${fieldsHtml}
    </div>
  `;
}