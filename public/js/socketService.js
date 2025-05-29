function getSessionIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('session'); // Look for ?session=your-key in the URL
}

const sessionId = getSessionIdFromUrl();

// Include the session ID in the connection query parameters
export const socket = io({
    query: { sessionId: sessionId }
});
