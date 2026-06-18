/**
 * Local Business Marketplace - Chat System Utilities
 */
window.Chat = {
  renderMessages: function(messages, currentUserId) {
    if (!messages.length) {
      return '<div class="chat-empty">No messages yet. Start the conversation!</div>';
    }
    return messages.map(msg => {
      const isOwn = msg.senderId === currentUserId;
      return `
        <div class="chat-msg ${isOwn ? 'own' : 'other'}">
          <div class="chat-bubble">${msg.message}</div>
          <div class="chat-time">${App.formatDateTime(msg.time)}</div>
        </div>
      `;
    }).join('');
  },
  send: function(senderId, receiverId, businessId, message) {
    return Store.createChat({
      senderId,
      receiverId,
      businessId,
      message,
      time: new Date().toISOString()
    });
  },
  scrollToBottom: function(containerId) {
    const el = document.getElementById(containerId);
    if (el) {
      // Small timeout to allow DOM parsing of new elements
      setTimeout(() => {
        el.scrollTop = el.scrollHeight;
      }, 50);
    }
  }
};
