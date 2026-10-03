/**
 * Canadian Aesthetic Board (CAB) - Verification Engine
 */
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("certIdInput");
  const verifyBtn = document.getElementById("verifyBtn");
  const resultContainer = document.getElementById("resultContainer");
  const errorContainer = document.getElementById("errorContainer");
  const printBtn = document.getElementById("printBtn");
  const shareBtn = document.getElementById("shareBtn");

  let certificatesData = null;

  // Load certificates database
  async function loadData() {
    if (certificatesData) return certificatesData;
    try {
      const response = await fetch("data/certificates.json");
      if (!response.ok) throw new Error("Database load failed");
      certificatesData = await response.json();
      return certificatesData;
    } catch (err) {
      console.error("Error loading registry data:", err);
      return null;
    }
  }

  // Parse ID from URL query or hash
  function getQueryId() {
    const search = window.location.search;
    const hash = window.location.hash;

    // Check ?id=GL-101
    const params = new URLSearchParams(search);
    if (params.get("id")) return params.get("id");

    // Check ?GL-101 directly
    if (search.length > 1 && !search.includes("=")) {
      return search.substring(1);
    }

    // Check #GL-101
    if (hash.length > 1) {
      return hash.substring(1);
    }

    return null;
  }

  // Verify Certificate
  async function performVerification(rawId) {
    if (!rawId) return;
    const cleanId = rawId.trim().toUpperCase();
    if (!cleanId) return;

    errorContainer.style.display = "none";
    resultContainer.style.display = "none";

    const data = await loadData();
    if (!data) {
      showError("Registry server unavailable. Please try again shortly.");
      return;
    }

    // Direct lookup by ID
    let record = data[cleanId];

    // Fallback: search values if cleanId matches without prefix or exact name
    if (!record) {
      const keys = Object.keys(data);
      for (const k of keys) {
        if (k.toUpperCase() === cleanId || k.replace(/[^A-Z0-9]/gi, '') === cleanId.replace(/[^A-Z0-9]/gi, '')) {
          record = data[k];
          break;
        }
      }
    }

    if (record) {
      displayRecord(record);
    } else {
      showError(`No active record found for Certificate ID: "${cleanId}". Please check the ID printed on the certificate.`);
    }
  }

  function displayRecord(record) {
    document.getElementById("resCertId").textContent = record.id;
    document.getElementById("resStudentName").textContent = record.student_name;
    document.getElementById("resCourseTitle").textContent = record.course_title;
    document.getElementById("resIssueDate").textContent = record.issue_date;
    document.getElementById("resStatus").textContent = record.status;
    document.getElementById("resCenter").textContent = record.accredited_center;
    document.getElementById("resTrainer").textContent = record.trainer;
    document.getElementById("resLevel").textContent = record.verification_level;

    resultContainer.style.display = "block";
    resultContainer.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showError(msg) {
    errorContainer.textContent = msg;
    errorContainer.style.display = "block";
  }

  // Event Listeners
  verifyBtn.addEventListener("click", () => {
    performVerification(searchInput.value);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      performVerification(searchInput.value);
    }
  });

  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      const id = document.getElementById("resCertId").textContent;
      const shareUrl = `${window.location.origin}${window.location.pathname}?id=${id}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        const origText = shareBtn.innerHTML;
        shareBtn.innerHTML = "<span>Copied Link!</span>";
        setTimeout(() => {
          shareBtn.innerHTML = origText;
        }, 2000);
      });
    });
  }

  // Auto-verify if ID is in URL
  const initialId = getQueryId();
  if (initialId) {
    searchInput.value = initialId.toUpperCase();
    performVerification(initialId);
  }
});
