// Point at localhost when developing locally; same origin in production
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080'
    : '';

// Silhouette placeholder shown in preview before a photo is uploaded
const PHOTO_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='130' height='130' viewBox='0 0 130 130'%3E%3Crect width='130' height='130' fill='%23e2e8f0'/%3E%3Ccircle cx='65' cy='48' r='26' fill='%23a0aec0'/%3E%3Cellipse cx='65' cy='108' rx='38' ry='26' fill='%23a0aec0'/%3E%3C/svg%3E";

let signatureTemplate = null;
let photoUrl = null;
let renderedHtml = null;
let isSubmitting = false;
let toastTimer = null;

// ── Boot ──────────────────────────────────────────────────────────────────────

async function init() {
    try {
        await loadTemplate();
    } catch {
        showToast('Could not reach the backend — is it running?');
    }
    attachListeners();
}

async function loadTemplate() {
    const res = await fetch(`${API_BASE}/api/template`);
    if (!res.ok) throw new Error('template fetch failed');
    const data = await res.json();
    signatureTemplate = data.template;
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

    document.getElementById('useUrlToggle').addEventListener('click', togglePhotoMode);
    document.getElementById('photoUrlInput').addEventListener('input', handlePhotoUrlInput);
    document.getElementById('signatureForm').addEventListener('submit', handleSubmit);
    document.getElementById('copyBtn').addEventListener('click', copyHtml);
}

// ── Photo handling ────────────────────────────────────────────────────────────

function togglePhotoMode() {
    const fileArea = document.getElementById('photoFileArea');
    const urlArea  = document.getElementById('photoUrlArea');
    const toggle   = document.getElementById('useUrlToggle');
    const toUrl    = urlArea.classList.contains('hidden');

    fileArea.classList.toggle('hidden', toUrl);
    urlArea.classList.toggle('hidden', !toUrl);
    toggle.textContent = toUrl ? 'Upload file instead' : 'Use URL instead';

    // Reset photo state when switching modes
    photoUrl = null;
    document.getElementById('photoStatus').textContent = '';
    clearFieldError('photo');
    updatePreview();
}

function handlePhotoUrlInput() {
    const url = document.getElementById('photoUrlInput').value.trim();
    photoUrl = url || null;

    const img = document.getElementById('photoImg');
    if (url) {
        document.getElementById('photoPlaceholder').classList.add('hidden');
        img.src = url;
        img.classList.remove('hidden');
    } else {
        document.getElementById('photoPlaceholder').classList.remove('hidden');
        img.classList.add('hidden');
    }
    clearFieldError('photo');
    updatePreview();
}

async function handlePhotoSelect(file) {
    if (!file.type.startsWith('image/')) {
        showFieldError('photo', 'Please select an image file.');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showFieldError('photo', 'Image must be under 5MB.');
        return;
    }
    clearFieldError('photo');

    // Show local blob preview immediately so the user gets instant feedback
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('photoPlaceholder').classList.add('hidden');
        const img = document.getElementById('photoImg');
        img.src = e.target.result;
        img.classList.remove('hidden');
    };
    reader.readAsDataURL(file);

    setPhotoStatus('uploading', 'Uploading…');

    const formData = new FormData();
    formData.append('file', file);

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
}

function setPhotoStatus(cls, text) {
    const el = document.getElementById('photoStatus');
    el.textContent = text;
    el.className = 'photo-upload-status' + (cls ? ` ${cls}` : '');
}

// ── Live preview ──────────────────────────────────────────────────────────────

function updatePreview() {
    if (!signatureTemplate) return;

    const d = getFormData();
    if (!d.first_name && !d.surname) {
        showPreviewPlaceholder();
        return;
    }

    const html = renderTemplate(signatureTemplate, {
        profilePhotoSrc:    photoUrl || PHOTO_PLACEHOLDER,
        firstName:          d.first_name   || 'First',
        surname:            d.surname      || 'Surname',
        jobTitle:           d.job_title    || 'Job Title',
        company:            'Spatialedge',
        phone:              d.phone        || '+XX XX XXX XXXX',
        emailAddress:       d.email        || 'email@example.com',
        companyWebsiteLink: 'spatialedge.ai',
        imageBase:          API_BASE || window.location.origin,
        linkedIn:           'spatialedge',
    });

    renderedHtml = html;
    document.getElementById('previewPlaceholder').classList.add('hidden');
    document.getElementById('previewFrame').innerHTML = html;
    document.getElementById('copyBtn').disabled = false;
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
    renderedHtml = null;
}

// ── Form submission ───────────────────────────────────────────────────────────

async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    clearAllErrors();
    const data = getFormData();
    if (!validateForm(data)) return;

    isSubmitting = true;
    setSubmitLoading(true);

    try {
        const res = await fetch(`${API_BASE}/api/signatures`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to generate signature');
        }
        document.getElementById('sentToEmail').textContent = data.email;
        document.getElementById('successModal').classList.remove('hidden');
    } catch (err) {
        showToast(err.message);
    } finally {
        isSubmitting = false;
        setSubmitLoading(false);
    }
}

function setSubmitLoading(loading) {
    const btn = document.getElementById('submitBtn');
    document.getElementById('btnText').classList.toggle('hidden', loading);
    document.getElementById('btnSpinner').classList.toggle('hidden', !loading);
    btn.disabled = loading;
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateForm(data) {
    let ok = true;

    if (!data.first_name)  { showFieldError('firstName', 'First name is required'); ok = false; }
    if (!data.surname)     { showFieldError('surname',   'Surname is required'); ok = false; }
    if (!data.job_title)   { showFieldError('jobTitle',  'Job title is required'); ok = false; }
    if (!data.phone)       { showFieldError('phone',     'Phone number is required'); ok = false; }

    if (!data.email) {
        showFieldError('email', 'Email address is required'); ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        showFieldError('email', 'Please enter a valid email address'); ok = false;
    }

    if (!photoUrl) {
        showFieldError('photo', 'Please upload a profile photo or provide a URL'); ok = false;
    }

    return ok;
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

function closeModal() {
    document.getElementById('successModal').classList.add('hidden');
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
