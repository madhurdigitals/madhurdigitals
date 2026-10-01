/* =========================================================
   TEMPLATE 5 — J.R.V.P.V. STUDENT ID CARD
   ========================================================= */

window.CARD_TEMPLATES = window.CARD_TEMPLATES || {};

(function () {

  /* =======================================================
     NORMALIZE FIELD NAMES
     ======================================================= */

  function t5NormalizeKey(str) {
    return String(str)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  /* =======================================================
     GET STUDENT FIELD
     ======================================================= */

  function t5GetField(student, ...possibleKeys) {

    const studentKeys = Object.keys(student || {});

    for (const wanted of possibleKeys) {

      const match = studentKeys.find(
        key =>
          t5NormalizeKey(key) === t5NormalizeKey(wanted)
      );

      if (
        match &&
        student[match] !== null &&
        student[match] !== undefined &&
        student[match] !== ""
      ) {
        return student[match];
      }
    }

    return "";
  }

  /* =======================================================
     ESCAPE HTML
     ======================================================= */

  function t5EscapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  }

  /* =======================================================
     SAFE PHOTO URL
     ======================================================= */

  function t5GetPhotoURL(photoLink) {

    if (!photoLink) {
      return "";
    }

    if (typeof getPhotoUrl === "function") {

      return getPhotoUrl(
        photoLink,
        "w_400,h_500,c_fill"
      );

    }

    return photoLink;
  }

  /* =======================================================
     TEMPLATE REGISTRATION
     ======================================================= */

  window.CARD_TEMPLATES["template_5"] = {

    orientation: "landscape",

    photoShape: "square",

    /* =====================================================
       FRONT SIDE
       ===================================================== */

    renderFront: function (student, schoolInfo, options = {}) {

      const s = student || {};
      const info = schoolInfo || {};

      /* SCHOOL INFORMATION */

      const schoolName =
        info.school_name ||
        options.schoolCode ||
        "";

      const schoolAddress =
        info.address ||
        "";

      /* STUDENT INFORMATION */

      const name = t5GetField(
        s,
        "name",
        "student_name"
      );

      const father = t5GetField(
        s,
        "father_s_name",
        "fathers_name",
        "father_name",
        "father"
      );

      const phone = t5GetField(
        s,
        "phone",
        "mobile",
        "mobile_no",
        "mobile_number",
        "contact"
      );

      const dob = t5GetField(
        s,
        "dob",
        "date_of_birth"
      );

      const address = t5GetField(
        s,
        "address",
        "student_address"
      );

      const className = t5GetField(
        s,
        "class",
        "class_name"
      );

      const section = t5GetField(
        s,
        "section"
      );

      const classSection = section
        ? `${className}-${section}`
        : className;

      /* SESSION */

      const session =
        options.session ||
        info.session ||
        "2024-25";

      /* LOGO */

      const logoUrl =
        info.logo_url ||
        info.school_logo ||
        info.logo ||
        "";

      /* SIGNATURE */

      const signatureUrl =
        info.principal_signature ||
        info.signature ||
        "";

      /* PHOTO */

      const photoLink = t5GetField(
        s,
        "photo_link",
        "photo",
        "photo_url"
      );

      const photoUrl = t5GetPhotoURL(photoLink);

      /* PHOTO HTML */

      const photo = photoUrl
        ? `
          <img
            class="t5-photo-img"
            src="${t5EscapeHTML(photoUrl)}"
            alt="Student Photo"
          >
        `
        : `
          <div class="t5-photo-placeholder">
            Photo
          </div>
        `;

      /* LOGO HTML */

      const logo = logoUrl
        ? `
          <img
            class="t5-logo"
            src="${t5EscapeHTML(logoUrl)}"
            alt="School Logo"
          >
        `
        : "";

      /* WATERMARK HTML */

      const watermark = logoUrl
        ? `
          <img
            class="t5-watermark"
            src="${t5EscapeHTML(logoUrl)}"
            alt=""
          >
        `
        : "";

      /* SIGNATURE HTML */

      const signature = signatureUrl
        ? `
          <img
            class="t5-signature"
            src="${t5EscapeHTML(signatureUrl)}"
            alt="Principal Signature"
          >
        `
        : "";

      /* ===================================================
         FRONT CARD HTML
         =================================================== */

      return `

        <div class="t5-front">

          <!-- HEADER -->

          <div class="t5-header">

            <div class="t5-logo-wrap">

              ${logo}

            </div>

            <div class="t5-school-info">

              <div class="t5-school-name">

                ${t5EscapeHTML(schoolName)}

              </div>

              <div class="t5-school-address">

                ${t5EscapeHTML(schoolAddress)}

              </div>

            </div>

          </div>

          <!-- YELLOW HEADER LINE -->

          <div class="t5-yellow-line"></div>

          <!-- MOBILE NUMBER -->

          <div class="t5-mobile">

            <span>Mob.:</span>

            ${t5EscapeHTML(phone)}

          </div>

          <!-- SESSION -->

          <div class="t5-session">

            IDENTITY CARD : ${t5EscapeHTML(session)}

          </div>

          <!-- WATERMARK -->

          ${watermark}

          <!-- STUDENT PHOTO -->

          <div class="t5-photo-area">

            <div class="t5-photo-wrap">

              ${photo}

            </div>

          </div>

          <!-- PHOTO LABEL -->

          <div class="t5-photo-label">

            &lt;Photo&gt;

          </div>

          <!-- STUDENT DETAILS -->

          <div class="t5-details">

            <div class="t5-student-name">

              <span class="t5-student-name-label">

                Student's Name:

              </span>

              ${t5EscapeHTML(name)}

            </div>

            <div class="t5-line">

              <span>F. Name:</span>

              ${t5EscapeHTML(father)}

            </div>

            <div class="t5-line">

              <span>Mobile No.:</span>

              ${t5EscapeHTML(phone)}

            </div>

            <div class="t5-line">

              <span>DOB:</span>

              ${t5EscapeHTML(dob)}

            </div>

            <div class="t5-line">

              <span>Address:</span>

              ${t5EscapeHTML(address)}

            </div>

          </div>

          <!-- CLASS BADGE -->

          <div class="t5-class-badge">

            <div class="t5-class-content">

              <span class="t5-class-label">

                Class

              </span>

              <span class="t5-class-value">

                ${t5EscapeHTML(classSection)}

              </span>

            </div>

          </div>

          <!-- FOOTER -->

          <div class="t5-footer"></div>

          <!-- GOLD ACCENT -->

          <div class="t5-footer-gold"></div>

          <!-- YELLOW DIAGONAL -->

          <div class="t5-footer-accent"></div>

          <!-- PRINCIPAL SIGNATURE -->

          <div class="t5-principal">

            ${signature}

            <div class="t5-principal-label">

              Principal

            </div>

          </div>

        </div>

      `;
    },

    /* =====================================================
       BACK SIDE
       ===================================================== */

    renderBack: function (schoolInfo) {

      const info = schoolInfo || {};

      const schoolName =
        info.school_name || "";

      const address =
        info.address || "";

      const contact =
        info.contact || "";

      return `

        <div class="t5-back">

          <div class="t5-back-title">

            IMPORTANT INSTRUCTIONS

          </div>

          <ul class="t5-back-list">

            <li>
              This card is the property of
              ${t5EscapeHTML(schoolName)}.
            </li>

            <li>
              This card is non-transferable.
            </li>

            <li>
              Report loss of card immediately.
            </li>

            <li>
              This card must be worn within the school premises.
            </li>

            <li>
              Return this card when leaving the school.
            </li>

          </ul>

          <div class="t5-back-footer">

            <div>
              ${t5EscapeHTML(schoolName)}
            </div>

            <div>
              ${t5EscapeHTML(address)}
            </div>

            <div>
              ${t5EscapeHTML(contact)}
            </div>

          </div>

        </div>

      `;
    }

  };

})();