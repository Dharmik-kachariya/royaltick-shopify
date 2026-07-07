// rt-wishlist.js

class RTWishlistManager {
  constructor() {
    this.storageKey = 'rt_wishlist';
    this.wishlist = this.getWishlist();
    this.init();
  }

  getWishlist() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to parse wishlist from LocalStorage', e);
      return [];
    }
  }

  saveWishlist(wishlist) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(wishlist));
      this.wishlist = wishlist;
      this.updateHeaderCounter();
      // Dispatch custom event for dynamic updates
      document.dispatchEvent(new CustomEvent('rt:wishlist:updated', { detail: { wishlist } }));
    } catch (e) {
      console.error('Failed to save wishlist to LocalStorage', e);
    }
  }

  init() {
    this.createToastContainer();
    this.createLoginModal();
    this.updateHeaderCounter();
    this.bindEvents();
    this.syncHeartStates();

    // If we are on the wishlist page, render the wishlist items
    if (document.getElementById('rt-wishlist-section')) {
      this.renderWishlistPage();
    }
  }

  // Create absolute-positioned toast element
  createToastContainer() {
    if (document.getElementById('rt-wishlist-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'rt-wishlist-toast';
    toast.className = 'rt-toast';
    toast.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C8A96A" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
      <span class="rt-toast__message"></span>
    `;
    document.body.appendChild(toast);
  }

  showToast(message) {
    const toast = document.getElementById('rt-wishlist-toast');
    if (!toast) return;
    toast.querySelector('.rt-toast__message').textContent = message;
    toast.classList.add('is-show');
    setTimeout(() => {
      toast.classList.remove('is-show');
    }, 3000);
  }

  // Create premium guest login modal
  createLoginModal() {
    if (document.getElementById('rt-wishlist-login-modal')) return;
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'rt-wishlist-login-modal';
    modalOverlay.className = 'rt-login-modal-overlay';
    modalOverlay.innerHTML = `
      <div class="rt-login-modal">
        <button type="button" class="rt-login-modal__close" aria-label="Close modal">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div class="rt-login-modal__icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C8A96A" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </div>
        <h3 class="rt-login-modal__title">Exclusive Timepieces</h3>
        <p class="rt-login-modal__text">Please sign in to save your favourite timepieces.</p>
        <div class="rt-login-modal__actions">
          <a href="/account/login" class="rt-wishlist-btn rt-wishlist-btn--primary">Sign In</a>
          <a href="/account/register" class="rt-wishlist-btn rt-wishlist-btn--secondary">Create Account</a>
          <button type="button" class="rt-wishlist-btn rt-wishlist-btn--tertiary rt-login-modal-close-btn">Continue Shopping</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);

    // Close logic
    const closeBtn = modalOverlay.querySelector('.rt-login-modal__close');
    const continueBtn = modalOverlay.querySelector('.rt-login-modal-close-btn');
    const closeMod = () => modalOverlay.classList.remove('is-open');
    closeBtn.addEventListener('click', closeMod);
    continueBtn.addEventListener('click', closeMod);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeMod();
    });
  }

  showLoginModal() {
    const modal = document.getElementById('rt-wishlist-login-modal');
    if (modal) modal.classList.add('is-open');
  }

  // Update header count based on length
  updateHeaderCounter() {
    const counters = document.querySelectorAll('.rt-header-wishlist__counter');
    counters.forEach(counter => {
      const count = this.wishlist.length;
      counter.textContent = count;
      counter.setAttribute('data-count', count);
    });
  }

  // Bind clicks dynamically (delegation)
  bindEvents() {
    document.addEventListener('click', (e) => {
      // Find the closest button having either class or data-product-handle
      const btn = e.target.closest('.rt-card-wishlist-btn, .rt-pdp-wishlist-btn, [data-product-handle]');
      if (btn && (btn.classList.contains('rt-card-wishlist-btn') || btn.classList.contains('rt-pdp-wishlist-btn'))) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleProduct(btn);
      }
    });
  }

  isCustomerLoggedIn() {
    // We check a global flag injected on the page
    return window.RT_CUSTOMER_LOGGED_IN === true;
  }

  toggleProduct(button) {
    const handle = button.getAttribute('data-product-handle');
    if (!handle) return;

    let currentList = [...this.wishlist];
    const index = currentList.indexOf(handle);

    if (index > -1) {
      // Remove
      currentList.splice(index, 1);
      this.saveWishlist(currentList);
      this.setButtonState(handle, false);
      this.showToast('Removed from Wishlist');
    } else {
      // Add
      currentList.push(handle);
      this.saveWishlist(currentList);
      this.setButtonState(handle, true);
      this.showToast('Added to Wishlist');
      
      // Redirect to wishlist page immediately on add for all buttons (PDP and Card Grid)
      setTimeout(() => {
        window.location.href = '/pages/wishlist';
      }, 500);
    }
  }

  // Sets active states on DOM elements for a given handle
  setButtonState(handle, isActive) {
    const buttons = document.querySelectorAll(`[data-product-handle="${handle}"]`);
    buttons.forEach(btn => {
      if (btn.classList.contains('rt-card-wishlist-btn') || btn.classList.contains('rt-pdp-wishlist-btn')) {
        if (isActive) {
          btn.classList.add('is-active');
          btn.setAttribute('aria-label', 'Remove from Wishlist');
          if (btn.classList.contains('rt-pdp-wishlist-btn')) {
            const spanText = btn.querySelector('.rt-pdp-wishlist-text');
            if (spanText) spanText.textContent = 'Remove from Wishlist';
          }
        } else {
          btn.classList.remove('is-active');
          btn.setAttribute('aria-label', 'Add to Wishlist');
          if (btn.classList.contains('rt-pdp-wishlist-btn')) {
            const spanText = btn.querySelector('.rt-pdp-wishlist-text');
            if (spanText) spanText.textContent = 'Add to Wishlist';
          }
        }
      }
    });
  }

  syncHeartStates() {
    this.wishlist.forEach(handle => {
      this.setButtonState(handle, true);
    });
  }

  // Wishlist Page Render
  async renderWishlistPage() {
    const grid = document.getElementById('rt-wishlist-grid');
    const wrapper = document.getElementById('rt-wishlist-grid-wrapper');
    const emptyState = document.getElementById('rt-wishlist-empty');
    const template = document.getElementById('rt-wishlist-card-template');

    if (!grid || !template) return;

    grid.innerHTML = '';

    if (this.wishlist.length === 0) {
      wrapper.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    wrapper.style.display = 'block';
    emptyState.style.display = 'none';

    // Show loading spinner
    grid.innerHTML = '<div class="rt-wishlist-loading" style="grid-column: 1/-1; text-align: center; padding: 50px 0;"><svg class="rt-spinner" width="40" height="40" viewBox="0 0 50 50" style="animation: rotate 2s linear infinite; stroke: #C8A96A;"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5" style="stroke-linecap: round; animation: dash 1.5s ease-in-out infinite;"></circle></svg></div>';

    try {
      const fetchPromises = this.wishlist.map(handle => 
        fetch(`/products/${handle}.js`)
          .then(res => {
            if (!res.ok) throw new Error('Product not found');
            return res.json();
          })
          .catch(() => null)
      );

      const products = (await Promise.all(fetchPromises)).filter(p => p !== null);

      grid.innerHTML = '';

      if (products.length === 0) {
        wrapper.style.display = 'none';
        emptyState.style.display = 'block';
        return;
      }

      const templateHtml = template.innerHTML;

      products.forEach(product => {
        const formattedPrice = Shopify.formatMoney ? Shopify.formatMoney(product.price, window.theme?.moneyFormat || 'Rs. {{amount}}') : `Rs. ${(product.price / 100).toFixed(2)}`;
        const availability = product.available ? 'In Stock' : 'Sold Out';
        const variantId = product.variants[0]?.id || '';
        const sku = product.variants[0]?.sku || 'N/A';
        const absoluteUrl = `${window.location.origin}${product.url}`;

        let cardHtml = templateHtml
          .replace(/\${handle}/g, product.handle)
          .replace(/\${id}/g, product.id)
          .replace(/\${title}/g, product.title)
          .replace(/\${url}/g, product.url)
          .replace(/\${absoluteUrl}/g, absoluteUrl)
          .replace(/\${vendor}/g, product.vendor)
          .replace(/\${type}/g, product.type || 'Timepiece')
          .replace(/\${featured_image}/g, product.featured_image || '')
          .replace(/\${price}/g, formattedPrice)
          .replace(/\${availability}/g, availability)
          .replace(/\${variantId}/g, variantId)
          .replace(/\${sku}/g, sku);

        const cardContainer = document.createElement('div');
        cardContainer.innerHTML = cardHtml.trim();
        const cardElement = cardContainer.firstChild;

        // Bind events inside card
        // Remove button
        cardElement.querySelector('.rt-wishlist-card__remove-btn-floating').addEventListener('click', (e) => {
          e.preventDefault();
          this.removeProductFromPage(product.handle, cardElement);
        });

        // ATC Button
        const atcBtn = cardElement.querySelector('.rt-wishlist-card__btn--atc');
        atcBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          await this.moveToCart(variantId, product.handle, cardElement);
        });

        // Share button
        cardElement.querySelector('.rt-wishlist-card__btn--share').addEventListener('click', (e) => {
          e.preventDefault();
          navigator.clipboard.writeText(absoluteUrl).then(() => {
            this.showToast('Product link copied to clipboard');
          });
        });

        grid.appendChild(cardElement);
      });

    } catch (e) {
      console.error('Error rendering wishlist page', e);
      grid.innerHTML = '<p class="rt-wishlist-error">Error loading wishlist items. Please refresh.</p>';
    }
  }

  removeProductFromPage(handle, cardElement) {
    cardElement.classList.add('is-removing');
    setTimeout(() => {
      let currentList = [...this.wishlist];
      const index = currentList.indexOf(handle);
      if (index > -1) {
        currentList.splice(index, 1);
        this.saveWishlist(currentList);
        this.setButtonState(handle, false);
      }
      cardElement.remove();
      
      const grid = document.getElementById('rt-wishlist-grid');
      const wrapper = document.getElementById('rt-wishlist-grid-wrapper');
      const emptyState = document.getElementById('rt-wishlist-empty');
      if (grid && grid.children.length === 0) {
        wrapper.style.display = 'none';
        emptyState.style.display = 'block';
      }
      this.showToast('Removed from Wishlist');
    }, 400);
  }

  async moveToCart(variantId, handle, cardElement) {
    if (!variantId) {
      this.showToast('No options available');
      return;
    }

    const atcBtn = cardElement.querySelector('.rt-wishlist-card__btn--atc');
    atcBtn.textContent = 'Adding...';
    atcBtn.disabled = true;

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: variantId, quantity: 1 }]
        })
      });

      if (!res.ok) throw new Error('ATC failed');

      // Update cart drawer or cart counters
      document.dispatchEvent(new CustomEvent('cart:updated'));
      if (window.CartDrawer && window.CartDrawer.render) {
        window.CartDrawer.render();
      }

      // Remove from wishlist
      this.removeProductFromPage(handle, cardElement);
      this.showToast('Moved to Cart');
    } catch (e) {
      console.error(e);
      atcBtn.textContent = 'Move to Cart';
      atcBtn.disabled = false;
      this.showToast('Failed to add to cart. Try again.');
    }
  }
}

// Global rotation animations for spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes rotate { 100% { transform: rotate(360deg); } }
  @keyframes dash {
    0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
    50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
    100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
  }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
  window.rtWishlistManager = new RTWishlistManager();
});
