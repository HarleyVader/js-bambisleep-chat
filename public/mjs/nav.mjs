export function createNav() {
    const navHTML = `
    <nav>
        <a href="/">bambisleep.chat</a>
        <a href="/psychodelic-trigger-mania">Psychodelic Trigger Mania</a>
        <a href="https://www.likera.com/forum/mybb/Thread-bambisleep-chat-Multipurpose-Bambi-Sleep-oriented-AI-GF">Like Ra's</a>
        <!-- <a href="/images">Images</a> -->
        <a href="/help">Help</a>
        <a href="/login">Login</a>
    </nav>
    `;
    document.body.insertAdjacentHTML('afterbegin', navHTML);
}