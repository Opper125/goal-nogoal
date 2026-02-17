/* ===== CONTACTS ===== */

// Open contacts modal
async function openContacts() {
    closeAllModals();
    openModal('contactsModal');
    await loadContacts();
}

// Load contacts
async function loadContacts() {
    const container = document.getElementById('contactsList');
    if (!container) return;

    container.innerHTML = '<div class="game-loading"><div class="spinner"></div><p>Loading contacts...</p></div>';

    const result = await apiGet('database', 'get-contacts');

    if (!result.success || !result.contacts || result.contacts.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-address-book"></i><p>No contacts available</p></div>';
        return;
    }

    container.innerHTML = result.contacts.map(contact => {
        const imgHtml = contact.imgUrl
            ? `<img src="${contact.imgUrl}" alt="${contact.name}" onerror="this.style.display='none'">`
            : `<div style="width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;"><i class="fas fa-user" style="color:#555;"></i></div>`;

        let actionHtml = '';
        if (contact.type === 'link' && contact.link) {
            actionHtml = `<div class="contact-action"><a href="${contact.link}" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i> Open</a></div>`;
        } else if (contact.type === 'address' && contact.address) {
            actionHtml = `<div class="contact-action"><button class="btn-copy" onclick="copyToClipboard('${contact.address}')"><i class="fas fa-copy"></i> Copy</button></div>`;
        } else if (contact.link) {
            actionHtml = `<div class="contact-action"><a href="${contact.link}" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i> Open</a></div>`;
        }

        return `
            <div class="contact-item">
                ${imgHtml}
                <div>
                    <div class="contact-name">${contact.name}</div>
                    ${contact.address ? `<div style="font-size:12px;color:#666;margin-top:2px;">${contact.address}</div>` : ''}
                </div>
                ${actionHtml}
            </div>
        `;
    }).join('');
}
