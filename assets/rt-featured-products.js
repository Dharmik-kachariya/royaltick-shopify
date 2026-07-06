import { StandardEvents, CartLinesUpdateEvent } from '@shopify/events';

// Color map for luxury watch variants swatch coloring
const COLOR_SWATCH_MAP = {
  black: '#111111',
  white: '#ffffff',
  gold: '#c9a227',
  silver: '#e0e0e0',
  'rose gold': '#b76e79',
  blue: '#1c3f60',
  green: '#1d3322',
  brown: '#5c4033',
  charcoal: '#36454f',
  grey: '#808080',
  gray: '#808080'
};

class RTFeaturedProducts {
  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this.container = container;
    this.sectionId = container.dataset.sectionId;
    this.grid = container.querySelector('.rt-products-grid');
    this.prevBtn = container.querySelector('.rt-slider-arrow--prev');
    this.nextBtn = container.querySelector('.rt-slider-arrow--next');
    this.pagination = container.querySelector('.rt-slider-pagination');
    
    this.enableSlider = container.dataset.enableSlider === 'true';
    this.autoplay = container.dataset.autoplay === 'true';
    this.autoplaySpeed = parseInt(container.dataset.autoplaySpeed) || 5000;
    
    this.autoplayInterval = null;
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.dragMultiplier = 1.2;
    
    // Quick View Modal elements
    this.modal = document.getElementById(`rt-quickview-modal-${this.sectionId}`);
    this.modalBody = this.modal ? this.modal.querySelector('.rt-quickview-modal__body') : null;
    this.modalClose = this.modal ? this.modal.querySelector('.rt-quickview-modal__close') : null;
    this.modalOverlay = this.modal ? this.modal.querySelector('.rt-quickview-modal__overlay') : null;

    this.init();
  }

  init() {
    this.initWishlist();
    this.initCardActions();
    this.initQuickView();
    
    if (this.enableSlider && this.grid) {
      this.initSlider();
    }
  }

  // --- WISHLIST MANAGEMENT ---
  getWishlist() {
    try {
      return JSON.parse(localStorage.getItem('rt-wishlist')) || [];
    } catch (e) {
      return [];
    }
  }

  /**
   * @param {string[]} wishlist
   */
  saveWishlist(wishlist) {
    localStorage.setItem('rt-wishlist', JSON.stringify(wishlist));
  }

  initWishlist() {
    const wishlist = this.getWishlist();
    this.container.querySelectorAll('.rt-btn-wishlist').forEach(btn => {
      const id = btn.dataset.productId;
      if (wishlist.includes(id)) {
        btn.classList.add('is-active');
      }
      
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleWishlist(btn, id);
      });
    });
  }

  /**
   * @param {HTMLElement} btn
   * @param {string} id
   */
  toggleWishlist(btn, id) {
    let wishlist = this.getWishlist();
    if (wishlist.includes(id)) {
      wishlist = wishlist.filter(item => item !== id);
      btn.classList.remove('is-active');
      this.showToast('Removed from wishlist');
    } else {
      wishlist.push(id);
      btn.classList.add('is-active');
      this.showToast('Added to wishlist');
    }
    this.saveWishlist(wishlist);
    
    // Sync other wishlist buttons across the page
    document.querySelectorAll(`.rt-btn-wishlist[data-product-id="${id}"]`).forEach(otherBtn => {
      if (wishlist.includes(id)) {
        otherBtn.classList.add('is-active');
      } else {
        otherBtn.classList.remove('is-active');
      }
    });
  }

  // --- CARD INTERACTIVE ACTIONS ---
  initCardActions() {
    // Quick Add
    this.container.querySelectorAll('.rt-btn-quickadd').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const variantId = btn.dataset.variantId;
        if (variantId) {
          this.addToCart(variantId, 1, btn);
        }
      });
    });

    // Share action
    this.container.querySelectorAll('.rt-btn-share').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const title = btn.dataset.productTitle;
        const url = btn.dataset.productUrl;
        
        if (navigator.share) {
          navigator.share({ title, url }).catch(() => {});
        } else {
          navigator.clipboard.writeText(url).then(() => {
            this.showToast('Link copied to clipboard');
          });
        }
      });
    });
  }

  // --- AJAX ADD TO CART ---
  /**
   * @param {string|number} variantId
   * @param {number} quantity
   * @param {HTMLElement} triggerButton
   */
  addToCart(variantId, quantity, triggerButton) {
    if (!variantId) return;

    // Standard Shopify event dispatch
    const deferredPromise = CartLinesUpdateEvent.createPromise();
    const event = new CartLinesUpdateEvent({
      action: 'add',
      context: 'product',
      lines: [
        {
          merchandiseId: variantId.toString(),
          quantity: quantity,
        },
      ],
      promise: deferredPromise.promise,
    });

    triggerButton.dispatchEvent(event);
    
    // Visual button states
    const originalText = triggerButton.querySelector('span') ? triggerButton.querySelector('span').textContent : '';
    triggerButton.disabled = true;
    if (triggerButton.querySelector('span')) {
      triggerButton.querySelector('span').textContent = 'Adding...';
    }

    fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: variantId,
        quantity: quantity
      })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response error');
        }
        return response.json();
      })
      .then(data => {
        if (data.status) {
          throw new Error(data.description || data.message || 'Error adding to cart');
        }
        
        // Resolve promise to notify standard cart drawer/updating
        deferredPromise.resolve({
          cart: CartLinesUpdateEvent.createCartFromAjaxResponse(data),
          detail: {
            didError: false,
            items: [data],
            source: 'rt-featured-products',
            sourceId: variantId.toString(),
            itemCount: quantity,
            productId: data.product_id
          }
        });

        if (triggerButton.querySelector('span')) {
          triggerButton.querySelector('span').textContent = 'Added!';
        }
        
        setTimeout(() => {
          triggerButton.disabled = false;
          if (triggerButton.querySelector('span')) {
            triggerButton.querySelector('span').textContent = originalText;
          }
        }, 1500);

        this.showToast('Product added to cart');
      })
      .catch(error => {
        deferredPromise.reject(error);
        
        if (triggerButton.querySelector('span')) {
          triggerButton.querySelector('span').textContent = 'Error';
        }
        
        setTimeout(() => {
          triggerButton.disabled = false;
          if (triggerButton.querySelector('span')) {
            triggerButton.querySelector('span').textContent = originalText;
          }
        }, 1500);

        this.showToast(error.message || 'Error adding to cart');
      });
  }

  // --- PRODUCT SLIDER LOGIC ---
  initSlider() {
    // Nav Arrow Clicks
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.scrollSlider('prev'));
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.scrollSlider('next'));
    }

    // Scroll / Resize triggers
    this.grid.addEventListener('scroll', () => {
      this.updateArrows();
      this.updatePaginationDots();
    });
    
    window.addEventListener('resize', () => {
      this.setupPagination();
      this.updateArrows();
    });

    // Touch / Drag to scroll
    this.grid.addEventListener('mousedown', (e) => this.dragStart(e));
    window.addEventListener('mousemove', (e) => this.dragMove(e));
    window.addEventListener('mouseup', () => this.dragEnd());
    
    this.grid.addEventListener('touchstart', (e) => this.dragStart(e));
    window.addEventListener('touchmove', (e) => this.dragMove(e));
    window.addEventListener('touchend', () => this.dragEnd());

    // Wheel assistance
    this.grid.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return; // Allow natural swipe
      if (this.grid.scrollWidth > this.grid.clientWidth) {
        // Prevent default only if we actually can scroll horizontally
        const isAtStart = this.grid.scrollLeft <= 0 && e.deltaY < 0;
        const isAtEnd = this.grid.scrollLeft >= (this.grid.scrollWidth - this.grid.clientWidth) && e.deltaY > 0;
        if (!isAtStart && !isAtEnd) {
          e.preventDefault();
          this.grid.scrollLeft += e.deltaY * 0.6;
        }
      }
    }, { passive: false });

    // Initial setup
    this.setupPagination();
    this.updateArrows();
    this.startAutoplay();

    // Autoplay pause on hover
    this.container.addEventListener('mouseenter', () => this.stopAutoplay());
    this.container.addEventListener('mouseleave', () => this.startAutoplay());
  }

  /**
   * @param {string} direction
   */
  scrollSlider(direction) {
    const card = this.grid.querySelector('.rt-product-card');
    if (!card) return;
    
    const cardWidth = card.clientWidth + 30; // Card width + gap
    const scrollAmount = direction === 'next' ? cardWidth : -cardWidth;
    this.grid.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }

  updateArrows() {
    if (!this.prevBtn || !this.nextBtn) return;
    
    const scrollLeft = this.grid.scrollLeft;
    const maxScroll = this.grid.scrollWidth - this.grid.clientWidth;
    
    this.prevBtn.disabled = scrollLeft <= 10;
    this.nextBtn.disabled = scrollLeft >= maxScroll - 10;
  }

  setupPagination() {
    if (!this.pagination) return;
    this.pagination.innerHTML = '';
    
    const cards = this.grid.querySelectorAll('.rt-product-card');
    if (cards.length === 0) return;
    
    const cardsVisible = Math.round(this.grid.clientWidth / cards[0].clientWidth);
    const dotsCount = Math.max(1, cards.length - cardsVisible + 1);

    if (dotsCount <= 1) {
      this.pagination.style.display = 'none';
      return;
    }
    
    this.pagination.style.display = 'flex';
    for (let i = 0; i < dotsCount; i++) {
      const dot = document.createElement('button');
      dot.className = `rt-slider-dot ${i === 0 ? 'is-active' : ''}`;
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
      dot.addEventListener('click', () => {
        const cardWidth = cards[0].clientWidth + 30;
        this.grid.scrollTo({ left: i * cardWidth, behavior: 'smooth' });
      });
      this.pagination.appendChild(dot);
    }
  }

  updatePaginationDots() {
    if (!this.pagination) return;
    const cards = this.grid.querySelectorAll('.rt-product-card');
    if (cards.length === 0) return;
    
    const cardWidth = cards[0].clientWidth + 30;
    const activeIndex = Math.round(this.grid.scrollLeft / cardWidth);
    
    const dots = this.pagination.querySelectorAll('.rt-slider-dot');
    dots.forEach((dot, idx) => {
      if (idx === activeIndex) {
        dot.classList.add('is-active');
      } else {
        dot.classList.remove('is-active');
      }
    });
  }

  /**
   * @param {any} e
   */
  dragStart(e) {
    this.isDragging = true;
    this.grid.style.scrollBehavior = 'auto';
    const pageX = e.pageX || (e.touches && e.touches[0] ? e.touches[0].pageX : 0);
    const pageY = e.pageY || (e.touches && e.touches[0] ? e.touches[0].pageY : 0);
    this.startX = pageX - this.grid.offsetLeft;
    this.startY = pageY - this.grid.offsetTop;
    this.scrollLeft = this.grid.scrollLeft;
    this.hasDeterminedDirection = false;
    this.isScrollingVertical = false;
  }

  /**
   * @param {any} e
   */
  dragMove(e) {
    if (!this.isDragging) return;

    const pageX = e.pageX || (e.touches && e.touches[0] ? e.touches[0].pageX : 0);
    const pageY = e.pageY || (e.touches && e.touches[0] ? e.touches[0].pageY : 0);

    if (e.touches && !this.hasDeterminedDirection) {
      const diffX = Math.abs(pageX - (this.startX + this.grid.offsetLeft));
      const diffY = Math.abs(pageY - (this.startY + this.grid.offsetTop));
      
      if (diffX < 5 && diffY < 5) return;
      
      this.hasDeterminedDirection = true;
      if (diffY > diffX) {
        this.isScrollingVertical = true;
        this.isDragging = false;
        return;
      }
    }

    if (this.isScrollingVertical) return;

    e.preventDefault();
    const x = pageX - this.grid.offsetLeft;
    const walk = (x - this.startX) * this.dragMultiplier;
    this.grid.scrollLeft = this.scrollLeft - walk;
  }

  dragEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.grid.style.scrollBehavior = 'smooth';
    
    // Snap to nearest card
    const cards = this.grid.querySelectorAll('.rt-product-card');
    if (cards.length > 0) {
      const cardWidth = cards[0].clientWidth + 30;
      const snapIndex = Math.round(this.grid.scrollLeft / cardWidth);
      this.grid.scrollTo({ left: snapIndex * cardWidth, behavior: 'smooth' });
    }
  }

  startAutoplay() {
    if (!this.autoplay) return;
    this.stopAutoplay();
    this.autoplayInterval = setInterval(() => {
      const maxScroll = this.grid.scrollWidth - this.grid.clientWidth;
      if (this.grid.scrollLeft >= maxScroll - 10) {
        this.grid.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        this.scrollSlider('next');
      }
    }, this.autoplaySpeed);
  }

  stopAutoplay() {
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
      this.autoplayInterval = null;
    }
  }

  // --- QUICK VIEW MODAL LOGIC ---
  initQuickView() {
    if (!this.modal) return;

    // Click event to open Quick View
    this.container.querySelectorAll('.rt-btn-quickview').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('.rt-product-card');
        const productJsonScript = card ? card.querySelector('.rt-product-json') : null;
        if (productJsonScript) {
          try {
            const productData = JSON.parse(productJsonScript.textContent);
            this.openQuickView(productData);
          } catch (err) {
            console.error('Failed to parse product JSON', err);
          }
        }
      });
    });

    // Close Modal Events
    if (this.modalClose) {
      this.modalClose.addEventListener('click', () => this.closeQuickView());
    }
    if (this.modalOverlay) {
      this.modalOverlay.addEventListener('click', () => this.closeQuickView());
    }
    
    // Keyboard close
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('is-open')) {
        this.closeQuickView();
      }
    });
  }

  /**
   * @param {any} product
   */
  openQuickView(product) {
    this.renderQuickView(product);
    this.modal.classList.add('is-open');
    document.body.style.overflow = 'hidden'; // Lock background scrolling
    this.initQuickViewInteractive(product);
  }

  closeQuickView() {
    this.modal.classList.remove('is-open');
    document.body.style.overflow = ''; // Unlock scrolling
    if (this.modalBody) {
      setTimeout(() => {
        this.modalBody.innerHTML = '';
      }, 400); // Clear layout after animation ends
    }
  }

  /**
   * @param {any} product
   */
  renderQuickView(product) {
    if (!this.modalBody) return;

    let galleryHtml = `
      <div class="rt-qv__gallery">
        <div class="rt-qv__main-image-wrap">
          <img src="${product.featured_image}" alt="${product.title}" class="rt-qv__main-image" />
        </div>
        <div class="rt-qv__thumbnails">
          ${product.images.map((img, i) => `
            <div class="rt-qv__thumb ${i === 0 ? 'is-active' : ''}" data-image-url="${img}">
              <img src="${img}" alt="Thumbnail ${i + 1}" />
            </div>
          `).join('')}
        </div>
      </div>
    `;

    let optionsHtml = '';
    if (product.options && product.options.length > 0 && product.options[0].name !== 'Title') {
      optionsHtml = product.options.map(option => {
        const isColor = option.name.toLowerCase().includes('color') || option.name.toLowerCase().includes('colour');
        return `
          <div class="rt-qv__option" data-option-name="${option.name}" data-option-position="${option.position}">
            <span class="rt-qv__option-label">${option.name}: <strong class="rt-qv__option-selected-val">${option.values[0]}</strong></span>
            <div class="rt-qv__swatches">
              ${option.values.map((val, i) => {
                if (isColor) {
                  const hexVal = COLOR_SWATCH_MAP[val.toLowerCase()] || val.toLowerCase();
                  return `
                    <button 
                      class="rt-qv__swatch-color ${i === 0 ? 'is-selected' : ''}" 
                      data-value="${val}" 
                      style="background-color: ${hexVal};" 
                      title="${val}"
                      aria-label="Select ${val}"
                    ></button>
                  `;
                } else {
                  return `
                    <button 
                      class="rt-qv__pill ${i === 0 ? 'is-selected' : ''}" 
                      data-value="${val}"
                    >${val}</button>
                  `;
                }
              }).join('')}
            </div>
          </div>
        `;
      }).join('');
    }

    const firstVariant = product.variants[0];
    const hasComparePrice = firstVariant.compare_at_price ? true : false;

    this.modalBody.innerHTML = `
      <div class="rt-qv">
        ${galleryHtml}
        <div class="rt-qv__details">
          <span class="rt-qv__brand">${product.vendor}</span>
          <h2 class="rt-qv__title">${product.title}</h2>
          
          <div class="rt-qv__price-wrap">
            <span class="rt-qv__price">${firstVariant.price}</span>
            <span class="rt-qv__compare-price" style="display: ${hasComparePrice ? 'inline' : 'none'}">
              ${firstVariant.compare_at_price || ''}
            </span>
          </div>

          <div class="rt-qv__desc">${product.description}</div>

          <div class="rt-qv__options-container">
            ${optionsHtml}
          </div>

          <!-- Quantity Selector -->
          <div class="rt-qv__qty-wrapper">
            <span class="rt-qv__qty-label">Quantity</span>
            <div class="rt-qv__qty-selector">
              <button class="rt-qv__qty-btn rt-qv__qty-btn--minus" aria-label="Decrease quantity">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              <input type="number" class="rt-qv__qty-input" value="1" min="1" aria-label="Quantity selector input" readonly />
              <button class="rt-qv__qty-btn rt-qv__qty-btn--plus" aria-label="Increase quantity">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>

          <!-- Purchase buttons -->
          <div class="rt-qv__actions">
            <button 
              class="rt-qv__btn-addtocart" 
              data-variant-id="${firstVariant.id}" 
              ${!firstVariant.available ? 'disabled' : ''}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              <span>${firstVariant.available ? 'Add To Cart' : 'Sold Out'}</span>
            </button>
            <button 
              class="rt-qv__btn-buynow" 
              data-variant-id="${firstVariant.id}" 
              ${!firstVariant.available ? 'disabled' : ''}
            >
              Buy It Now
            </button>
          </div>

        </div>
      </div>
    `;
  }

  /**
   * @param {any} product
   */
  initQuickViewInteractive(product) {
    const qv = this.modalBody;
    if (!qv) return;

    // Gallery Thumbnail Clicks
    const mainImg = qv.querySelector('.rt-qv__main-image');
    const thumbs = qv.querySelectorAll('.rt-qv__thumb');
    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        thumbs.forEach(t => t.classList.remove('is-active'));
        thumb.classList.add('is-active');
        if (mainImg) {
          mainImg.src = thumb.dataset.imageUrl;
        }
      });
    });

    // Variant Swatch selection logic
    const optionBlocks = qv.querySelectorAll('.rt-qv__option');
    const updateVariant = () => {
      const selectedOptions = {};
      optionBlocks.forEach(block => {
        const optionName = block.dataset.optionName;
        const selectedBtn = block.querySelector('.is-selected');
        if (selectedBtn) {
          selectedOptions[optionName] = selectedBtn.dataset.value;
          const valLabel = block.querySelector('.rt-qv__option-selected-val');
          if (valLabel) valLabel.textContent = selectedBtn.dataset.value;
        }
      });

      // Find variant matching all selections
      const matchingVariant = product.variants.find(variant => {
        // Option 1
        const opt1Match = !product.options[0] || variant.option1 === selectedOptions[product.options[0].name];
        // Option 2
        const opt2Match = !product.options[1] || variant.option2 === selectedOptions[product.options[1].name];
        // Option 3
        const opt3Match = !product.options[2] || variant.option3 === selectedOptions[product.options[2].name];
        return opt1Match && opt2Match && opt3Match;
      });

      const addToCartBtn = qv.querySelector('.rt-qv__btn-addtocart');
      const buyNowBtn = qv.querySelector('.rt-qv__btn-buynow');
      const priceVal = qv.querySelector('.rt-qv__price');
      const comparePriceVal = qv.querySelector('.rt-qv__compare-price');

      if (matchingVariant) {
        // Update Price
        if (priceVal) priceVal.textContent = matchingVariant.price;
        if (comparePriceVal) {
          if (matchingVariant.compare_at_price) {
            comparePriceVal.textContent = matchingVariant.compare_at_price;
            comparePriceVal.style.display = 'inline';
          } else {
            comparePriceVal.style.display = 'none';
          }
        }

        // Update Gallery Image if variant has a featured image
        if (matchingVariant.featured_image && mainImg) {
          mainImg.src = matchingVariant.featured_image;
          // Highlight match thumbnail if present
          thumbs.forEach(t => {
            if (t.dataset.imageUrl === matchingVariant.featured_image) {
              t.classList.add('is-active');
            } else {
              t.classList.remove('is-active');
            }
          });
        }

        // Update purchase button status
        if (addToCartBtn) {
          addToCartBtn.dataset.variantId = matchingVariant.id;
          addToCartBtn.disabled = !matchingVariant.available;
          addToCartBtn.querySelector('span').textContent = matchingVariant.available ? 'Add To Cart' : 'Sold Out';
        }
        if (buyNowBtn) {
          buyNowBtn.dataset.variantId = matchingVariant.id;
          buyNowBtn.disabled = !matchingVariant.available;
        }
      } else {
        // No match (unsupported variant combination)
        if (addToCartBtn) {
          addToCartBtn.disabled = true;
          addToCartBtn.querySelector('span').textContent = 'Unavailable';
        }
        if (buyNowBtn) buyNowBtn.disabled = true;
      }
    };

    optionBlocks.forEach(block => {
      const swatches = block.querySelectorAll('button');
      swatches.forEach(btn => {
        btn.addEventListener('click', () => {
          swatches.forEach(b => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');
          updateVariant();
        });
      });
    });

    // Quantity Selector logic
    const qtyInput = qv.querySelector('.rt-qv__qty-input');
    const minusBtn = qv.querySelector('.rt-qv__qty-btn--minus');
    const plusBtn = qv.querySelector('.rt-qv__qty-btn--plus');

    if (qtyInput && minusBtn && plusBtn) {
      minusBtn.addEventListener('click', () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val > 1) {
          qtyInput.value = val - 1;
        }
      });
      plusBtn.addEventListener('click', () => {
        let val = parseInt(qtyInput.value) || 1;
        qtyInput.value = val + 1;
      });
    }

    // Modal Add To Cart Click handler
    const qvAddToCart = qv.querySelector('.rt-qv__btn-addtocart');
    if (qvAddToCart) {
      qvAddToCart.addEventListener('click', () => {
        const variantId = qvAddToCart.dataset.variantId;
        const qty = parseInt(qtyInput.value) || 1;
        this.addToCart(variantId, qty, qvAddToCart);
      });
    }

    // Modal Buy It Now redirect
    const qvBuyNow = qv.querySelector('.rt-qv__btn-buynow');
    if (qvBuyNow) {
      qvBuyNow.addEventListener('click', () => {
        const variantId = qvBuyNow.dataset.variantId;
        const qty = parseInt(qtyInput.value) || 1;
        
        // standard buy now checkout redirect
        window.location.href = `/cart/${variantId}:${qty}`;
      });
    }
  }

  // --- TOAST NOTIFICATIONS ---
  /**
   * @param {string} message
   */
  showToast(message) {
    let toast = document.querySelector('.rt-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'rt-toast';
      document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.classList.add('is-visible');
    
    // Clear previous timeouts
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2500);
  }
}

// Initialize Featured Products on page load
const initRTFeaturedProducts = () => {
  document.querySelectorAll('.rt-featured-products').forEach(section => {
    if (!section.dataset.rtInitialized) {
      section.dataset.rtInitialized = 'true';
      new RTFeaturedProducts(section);
    }
  });
};

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRTFeaturedProducts);
} else {
  initRTFeaturedProducts();
}

// Support Shopify Theme Editor re-renders / loads
document.addEventListener('shopify:section:load', (e) => {
  const target = e.target;
  if (target instanceof Element && (target.classList.contains('rt-featured-products-section') || target.querySelector('.rt-featured-products'))) {
    initRTFeaturedProducts();
  }
});
