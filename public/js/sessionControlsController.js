import { socket } from './socketService.js';
import {
    sessionNameInput,
    joinSessionBtn,
    copySessionLinkBtn,
    sessionTitleElement,
    homeBtn,
    currentSessionNameLabel,
    activeSessionsDropdown,
    createNewSessionBtn // Import the new button
} from './domElements.js'; 

const DEFAULT_SESSION_ID = 'default'; // Define client-side default session ID

function navigateToSession() {
    if (!sessionNameInput) return;
    const sessionName = sessionNameInput.value.trim();
    if (sessionName) {
        window.location.href = `${window.location.origin}${window.location.pathname}?session=${encodeURIComponent(sessionName)}`;
    } else {
        alert("Please enter a session name.");
    }
}

function generateRandomSessionName() {
    // Simple random string generator (you might want something more robust for true uniqueness if scaling)
    const randomPart = Math.random().toString(36).substring(2, 8);
    const timestampPart = Date.now().toString(36).slice(-4);
    return `${randomPart}${timestampPart}`;
}

function populateActiveSessionsDropdown(sessionsList) {
    if (!activeSessionsDropdown) return;
    const currentDropdownValue = activeSessionsDropdown.value; // Preserve current selection if possible
    activeSessionsDropdown.innerHTML = ''; // Clear existing options

    // Add a default "Select a session" option
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "Switch to session...";
    defaultOption.disabled = true; // Make it non-selectable as a navigation target
    activeSessionsDropdown.appendChild(defaultOption);

    const urlParams = new URLSearchParams(window.location.search);
    const currentSessionIdFromUrl = urlParams.get('session') || DEFAULT_SESSION_ID;

    sessionsList.forEach(session => {
        const option = document.createElement('option');
        option.value = session.id;
        // Display the session title, fallback to a formatted ID if title is generic
        option.textContent = (session.title && session.title !== `Session: ${session.id}` && session.title !== "T-Collab") 
                             ? session.title 
                             : (session.id === DEFAULT_SESSION_ID ? "T-Collab (Default)" : `Session: ${session.id}`);
        if (session.id === currentSessionIdFromUrl) {
            option.selected = true;
        }
        activeSessionsDropdown.appendChild(option);
    });
    // Restore selection or default if current session is not in the list (e.g. after deleting a session)
    activeSessionsDropdown.value = currentDropdownValue && activeSessionsDropdown.querySelector(`option[value="${currentDropdownValue}"]`) ? currentDropdownValue : "";
    if (!activeSessionsDropdown.value && currentSessionIdFromUrl) { // If no value selected, try to select current session
        activeSessionsDropdown.value = currentSessionIdFromUrl;
    }
}

export function initializeSessionControls() {

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

        // Listen for the list of active sessions
        socket.on('activeSessionsList', (sessionsList) => {
            populateActiveSessionsDropdown(sessionsList);
        });
    }

    // Setup for active sessions dropdown navigation
    if (activeSessionsDropdown) {
        activeSessionsDropdown.addEventListener('change', (event) => {
            const selectedSessionId = event.target.value;
            if (selectedSessionId && selectedSessionId !== (new URLSearchParams(window.location.search).get('session') || DEFAULT_SESSION_ID)) {
                navigateToSession(selectedSessionId); // Use a modified navigateToSession or inline
                window.location.href = `${window.location.origin}${window.location.pathname}?session=${encodeURIComponent(selectedSessionId)}`;
            }
        });
    }

    // Setup for Create New Session button
    if (createNewSessionBtn) {
        createNewSessionBtn.addEventListener('click', () => {
            const newSessionName = generateRandomSessionName();
            // Navigate to the new session
            window.location.href = `${window.location.origin}${window.location.pathname}?session=${encodeURIComponent(newSessionName)}`;
        });
    }
}