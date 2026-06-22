// Point at localhost when developing locally; same origin in production
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080'
    : '';

// Silhouette placeholder shown in preview before a photo is uploaded
const PHOTO_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='130' height='130' viewBox='0 0 130 130'%3E%3Crect width='130' height='130' fill='%23e2e8f0'/%3E%3Ccircle cx='65' cy='48' r='26' fill='%23a0aec0'/%3E%3Cellipse cx='65' cy='108' rx='38' ry='26' fill='%23a0aec0'/%3E%3C/svg%3E";

const COMPRESS_THRESHOLD_BYTES = 5 * 1024 * 1024; // 5 MB

let templateWithPhoto = null;
let templateWithout = null;
let photoUrl = null;
let renderedHtml = null;
let toastTimer = null;
let cropperInstance = null;
let includePhoto = true;

// ── Boot ──────────────────────────────────────────────────────────────────────

async function init() {
    try {
        await loadTemplates();
    } catch {
        showToast('Could not reach the backend — is it running?');
    }
    attachListeners();
}

async function loadTemplates() {
    const res = await fetch(`${API_BASE}/api/templates`);
    if (!res.ok) throw new Error('templates fetch failed');
    const data = await res.json();
    templateWithPhoto = data.with_photo;
    templateWithout = data.without_photo;
}

// ── Event listeners ───────────────────────────────────────────────────────────

function attachListeners() {
    ['firstName', 'surname', 'jobTitle', 'phone', 'email'].forEach(id =>
        document.getElementById(id).addEventListener('input', updatePreview)
    );

    const fileInput  = document.getElementById('photoFile');
    const uploadArea = document.getElementById('photoUploadArea');

    fileInput.addEventListener('change', e => {
        if (e.target.files[0]) handlePhotoSelect(e.target.files[0]);
    });

    uploadArea.addEventListener('dragover', e => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', e => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) handlePhotoSelect(e.dataTransfer.files[0]);
    });

    document.getElementById('toggleWith').addEventListener('click', () => selectVariant(true));
    document.getElementById('toggleWithout').addEventListener('click', () => selectVariant(false));
    document.getElementById('copyBtn').addEventListener('click', copyHtml);
    document.getElementById('addGmailBtn').addEventListener('click', openGmailModal);
}

// ── Variant toggle ────────────────────────────────────────────────────────────

function selectVariant(withPhoto) {
    includePhoto = withPhoto;

    const toggle  = document.getElementById('photoToggle');
    const btnWith = document.getElementById('toggleWith');
    const btnWithout = document.getElementById('toggleWithout');
    const content = document.getElementById('photoSectionContent');

    toggle.classList.toggle('variant-without', !withPhoto);
    btnWith.classList.toggle('active', withPhoto);
    btnWithout.classList.toggle('active', !withPhoto);

    content.classList.toggle('collapsed', !withPhoto);

    updatePreview();
}

// ── Photo handling ────────────────────────────────────────────────────────────

async function handlePhotoSelect(file) {
    if (!file.type.startsWith('image/')) {
        showFieldError('photo', 'Please select an image file.');
        return;
    }
    clearFieldError('photo');
    const processed = await preprocessImageFile(file);
    openCropModal(processed);
}

// ── Image compression ─────────────────────────────────────────────────────────

async function preprocessImageFile(file) {
    if (file.size <= COMPRESS_THRESHOLD_BYTES) return file;

    return new Promise(resolve => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const MAX_DIM = 2000;
            let { naturalWidth: w, naturalHeight: h } = img;
            if (w > MAX_DIM || h > MAX_DIM) {
                const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            canvas.toBlob(blob => {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.85);
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
        img.src = objectUrl;
    });
}

// ── Crop modal ────────────────────────────────────────────────────────────────

function openCropModal(file) {
    const cropImg = document.getElementById('cropImage');
    if (cropImg.src.startsWith('blob:')) URL.revokeObjectURL(cropImg.src);

    cropImg.src = URL.createObjectURL(file);
    cropImg.onload = () => {
        if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
        cropperInstance = new Cropper(cropImg, {
            aspectRatio: 1,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.9,
            guides: false,
            center: false,
            highlight: false,
            background: false,
            toggleDragModeOnDblclick: false,
        });
    };
    document.getElementById('cropModal').classList.remove('hidden');
}

function confirmCrop() {
    if (!cropperInstance) return;

    document.getElementById('cropBtnText').classList.add('hidden');
    document.getElementById('cropBtnSpinner').classList.remove('hidden');

    const canvas = cropperInstance.getCroppedCanvas({ width: 500, height: 500, imageSmoothingQuality: 'high' });

    canvas.toBlob(async (blob) => {
        document.getElementById('photoPlaceholder').classList.add('hidden');
        const previewImg = document.getElementById('photoImg');
        previewImg.src = canvas.toDataURL('image/jpeg', 0.9);
        previewImg.classList.remove('hidden');

        closeCropModal();
        setPhotoStatus('uploading', 'Uploading…');

        const formData = new FormData();
        formData.append('file', blob, 'photo.jpg');

        try {
            const res = await fetch(`${API_BASE}/api/photos`, { method: 'POST', body: formData });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Upload failed');
            }
            const { url } = await res.json();
            photoUrl = url;
            setPhotoStatus('success', '✓ Photo uploaded');
            updatePreview();
        } catch (err) {
            setPhotoStatus('error', `✗ ${err.message}`);
            showFieldError('photo', err.message);
            photoUrl = null;
        }
    }, 'image/jpeg', 0.9);
}

function cancelCrop() {
    closeCropModal();
}

function closeCropModal() {
    document.getElementById('cropModal').classList.add('hidden');
    document.getElementById('cropBtnText').classList.remove('hidden');
    document.getElementById('cropBtnSpinner').classList.add('hidden');
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
    const cropImg = document.getElementById('cropImage');
    if (cropImg.src.startsWith('blob:')) { URL.revokeObjectURL(cropImg.src); cropImg.src = ''; }
}

function setPhotoStatus(cls, text) {
    const el = document.getElementById('photoStatus');
    el.textContent = text;
    el.className = 'photo-upload-status' + (cls ? ` ${cls}` : '');
}

// ── Live preview ──────────────────────────────────────────────────────────────

function updatePreview() {
    const template = includePhoto ? templateWithPhoto : templateWithout;
    if (!template) return;

    const d = getFormData();
    if (!d.first_name && !d.surname) {
        showPreviewPlaceholder();
        return;
    }

    const html = renderTemplate(template, {
        profilePhotoSrc:    photoUrl || PHOTO_PLACEHOLDER,
        firstName:          d.first_name   || 'First',
        surname:            d.surname      || 'Surname',
        jobTitle:           d.job_title    || 'Job Title',
        company:            'Spatialedge',
        phone:              d.phone        || '',
        emailAddress:       d.email        || 'email@example.com',
        companyWebsiteLink: 'spatialedge.ai',
        imageBase:          API_BASE || window.location.origin,
        linkedIn:           'spatialedge',
    });

    renderedHtml = html;
    document.getElementById('previewPlaceholder').classList.add('hidden');
    document.getElementById('previewFrame').innerHTML = html;
    document.getElementById('copyBtn').disabled = false;
    document.getElementById('addGmailBtn').disabled = false;
}

function renderTemplate(template, data) {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
        data[key] !== undefined && data[key] !== null ? String(data[key]) : ''
    );
}

function showPreviewPlaceholder() {
    document.getElementById('previewPlaceholder').classList.remove('hidden');
    document.getElementById('previewFrame').innerHTML = '';
    document.getElementById('copyBtn').disabled = true;
    document.getElementById('addGmailBtn').disabled = true;
    renderedHtml = null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFormData() {
    return {
        first_name:        document.getElementById('firstName').value.trim(),
        surname:           document.getElementById('surname').value.trim(),
        job_title:         document.getElementById('jobTitle').value.trim(),
        phone:             document.getElementById('phone').value.trim(),
        email:             document.getElementById('email').value.trim(),
        profile_photo_url: photoUrl || '',
    };
}

function showFieldError(fieldId, message) {
    const err = document.getElementById(`${fieldId}Error`);
    if (err) err.textContent = message;
    const input = document.getElementById(fieldId);
    if (input) input.classList.add('error');
}

function clearFieldError(fieldId) {
    const err = document.getElementById(`${fieldId}Error`);
    if (err) err.textContent = '';
    const input = document.getElementById(fieldId);
    if (input) input.classList.remove('error');
}

function clearAllErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

function showToast(message) {
    const toast = document.getElementById('errorToast');
    document.getElementById('toastMessage').textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 4500);
}

async function copyHtml() {
    if (!renderedHtml) return;
    try {
        await navigator.clipboard.writeText(renderedHtml);
        const btn = document.getElementById('copyBtn');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy HTML'; }, 2000);
    } catch {
        showToast('Could not copy to clipboard — try a different browser.');
    }
}

// ── Gmail modal ───────────────────────────────────────────────────────────────

function openGmailModal() {
    if (!renderedHtml) return;
    document.getElementById('gmailSignaturePreview').innerHTML =
        `<div class="gmail-signature-box"><div class="gmail-signature-scaler">${renderedHtml}</div></div>`;
    document.getElementById('gmailModal').classList.remove('hidden');
    requestAnimationFrame(fitSignaturePreview);
}

function fitSignaturePreview() {
    const box = document.querySelector('.gmail-signature-box');
    const scaler = document.querySelector('.gmail-signature-scaler');
    if (!box || !scaler) return;
    const available = box.clientWidth - 48;
    const natural = scaler.scrollWidth;
    if (natural > 0) {
        const scale = Math.min(1, available / natural);
        scaler.style.transform = `scale(${scale})`;
        box.style.height = `${scaler.offsetHeight * scale + 40}px`;
    }
}

function closeGmailModal() {
    document.getElementById('gmailModal').classList.add('hidden');
    document.getElementById('gmailSignaturePreview').innerHTML = '';
    const btn = document.getElementById('copyForGmailBtn');
    btn.textContent = 'Copy Signature';
}

async function copyForGmail() {
    if (!renderedHtml) return;
    const btn = document.getElementById('copyForGmailBtn');
    try {
        await navigator.clipboard.write([
            new ClipboardItem({ 'text/html': new Blob([renderedHtml], { type: 'text/html' }) })
        ]);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy Signature'; }, 2000);
    } catch {
        const el = document.createElement('div');
        el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
        el.contentEditable = 'true';
        el.innerHTML = renderedHtml;
        document.body.appendChild(el);
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const ok = document.execCommand('copy');
        sel.removeAllRanges();
        document.body.removeChild(el);
        if (ok) {
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy Signature'; }, 2000);
        } else {
            showToast('Could not copy — try a different browser.');
        }
    }
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
