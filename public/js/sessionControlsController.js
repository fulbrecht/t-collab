import { socket } from './socketService.js';
import {
    sessionNameInput,
    joinSessionBtn,
    copySessionLinkBtn,
    sessionTitleElement,
    homeBtn,
    currentSessionNameLabel
} from './domElements.js';

function navigateToSession() {
    if (!sessionNameInput) return;
    const sessionName = sessionNameInput.value.trim();
    if (sessionName) {
        window.location.href = `${window.location.origin}${window.location.pathname}?session=${encodeURIComponent(sessionName)}`;
    } else {
        alert("Please enter a session name.");
    }
}

export function initializeSessionControls() {


    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            window.location.href = window.location.origin;
        });
    }

    // Setup for session input and join button
    if (sessionNameInput && joinSessionBtn) {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionNameFromUrl = urlParams.get('session');

        if (sessionNameFromUrl) {
            sessionNameInput.value = decodeURIComponent(sessionNameFromUrl);
        }

        joinSessionBtn.addEventListener('click', navigateToSession);
        sessionNameInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                navigateToSession();
            }
        });
    } else {
        console.warn("Session input field ('sessionNameInput') or join button ('joinSessionBtn') not found. Session navigation UI may not work correctly.");
    }

    // Setup for copy session link button
    if (copySessionLinkBtn) {
        copySessionLinkBtn.addEventListener('click', () => {
            const urlToCopy = window.location.href;
            navigator.clipboard.writeText(urlToCopy).then(() => {
                const originalText = copySessionLinkBtn.textContent;
                copySessionLinkBtn.textContent = 'Copied!';
                copySessionLinkBtn.disabled = true;
                setTimeout(() => {
                    copySessionLinkBtn.textContent = originalText;
                    copySessionLinkBtn.disabled = false;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy link: ', err);
                alert('Failed to copy link. Your browser might not support this feature or permissions may be denied. Please copy the link manually from the address bar.');
            });
        });
    } else {
        console.warn("Copy Session Link button ('copySessionLinkBtn') not found. This feature will be unavailable.");
    }

    // Setup for editable session title
    if (sessionTitleElement) {
        sessionTitleElement.addEventListener('blur', () => {
            const newTitle = sessionTitleElement.textContent.trim();
            if (socket) {
                socket.emit('updateSessionTitle', newTitle);
            } else {
                console.error("Socket not initialized when trying to emit updateSessionTitle.");
            }
        });

        sessionTitleElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                sessionTitleElement.blur();
            }
        });

        // Listener for session title updates from the server
        if (socket) {
            socket.on('sessionTitleUpdated', (newTitle) => {
                if (document.activeElement !== sessionTitleElement) {
                    sessionTitleElement.textContent = newTitle;
                } else {
                    console.log("Session title updated by another user, but current user is editing. Local changes preserved for now.");
                }
            });
        }
    } else {
        console.warn("Session title element ('sessionTitle') not found. This feature will be unavailable.");
    }

    if (socket) {
        // When the server sends the initial title (e.g., upon connection)
        socket.on('initialSessionTitle', (title) => { // Or whatever event your server sends
            if (currentSessionNameLabel) {
                currentSessionNameLabel.textContent = title;
            }
            // Also update the main H2 title if it's still showing loading text
            if (sessionTitleElement && (sessionTitleElement.textContent.trim() === "Loading Session Title..." || !sessionTitleElement.textContent.trim())) {
                sessionTitleElement.textContent = title;
            }
        });

        // When the session title is updated by any means (e.g., user edit, import)
        socket.on('sessionTitleUpdated', (newTitle) => {
            if (sessionTitleElement && document.activeElement !== sessionTitleElement) {
                sessionTitleElement.textContent = newTitle;
            }
            if (currentSessionNameLabel) {
                currentSessionNameLabel.textContent = newTitle;
            }
        });
    }
}