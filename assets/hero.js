/**
 * RoyalTick - Cinematic Luxury Hero Section Controller
 * Includes scroll reveal, requestAnimationFrame mouse parallax, and prefers-reduced-motion checks.
 */

(function () {
  const initHero = () => {
    // Check user accessibility preference for reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      // Deactivate scroll reveals and parallax by adding class to the body/section
      document.querySelectorAll('.rt-reveal').forEach((el) => {
        el.classList.add('rt-reveal--active');
      });
      return;
    }

    // --- 1. Viewport Scroll Reveal (Intersection Observer) ---
    const revealElements = document.querySelectorAll('.rt-reveal');
    if (revealElements.length !== 0) {
      const observerOptions = {
        root: null,
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
      };

      const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('rt-reveal--active');
            observer.unobserve(entry.target);
          }
        });
      }, observerOptions);

      revealElements.forEach((el) => observer.observe(el));
    }

    // --- 2. Throttled Mouse Parallax (requestAnimationFrame) ---
    const splitHeroes = document.querySelectorAll('.rt-hero--luxury-split[data-mouse-parallax="true"]');
    splitHeroes.forEach((hero) => {
      /** @type {HTMLElement | null} */
      const media = hero.querySelector('.rt-hero__media-parallax img, .rt-hero__media-parallax video, .rt-hero__media-parallax svg');
      if (!media) return;

      let ticking = false;
      let mouseX = 0;
      let mouseY = 0;
      let targetX = 0;
      let targetY = 0;

      const updatePosition = () => {
        // Subtle lerp or spring transition (easing)
        targetX += (mouseX - targetX) * 0.1;
        targetY += (mouseY - targetY) * 0.1;

        // Limit translation range up to max 25px
        const moveX = targetX * 25;
        const moveY = targetY * 25;

        media.style.transform = `translate3d(${moveX}px, ${moveY}px, 0) scale3d(1.05, 1.05, 1)`;
        ticking = false;
      };

      /**
       * @param {MouseEvent} e
       */
      const onMouseMove = (e) => {
        if (window.innerWidth < 990) return; // Desktop only

        const rect = hero.getBoundingClientRect();
        // Calculate normalized coordinate offset relative to hero center (-0.5 to 0.5)
        mouseX = (e.clientX - rect.left) / rect.width - 0.5;
        mouseY = (e.clientY - rect.top) / rect.height - 0.5;

        if (!ticking) {
          window.requestAnimationFrame(updatePosition);
          ticking = true;
        }
      };

      const onMouseLeave = () => {
        mouseX = 0;
        mouseY = 0;
        // Smoothly return image back to origin using css transitions
        media.style.transition = 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        media.style.transform = 'translate3d(0px, 0px, 0) scale3d(1, 1, 1)';
        
        // Remove transitions after animation concludes to avoid conflicts with mouse movements
        setTimeout(() => {
          if (mouseX === 0 && mouseY === 0) {
            media.style.transition = '';
          }
        }, 800);
      };

      const onMouseEnter = () => {
        media.style.transition = '';
      };

      hero.addEventListener('mousemove', onMouseMove, { passive: true });
      hero.addEventListener('mouseleave', onMouseLeave);
      hero.addEventListener('mouseenter', onMouseEnter);
    });

    // --- 3. Luxury Video Hero Reveal ---
    const luxuryVideoHeros = document.querySelectorAll('.rt-luxury-video-hero');
    luxuryVideoHeros.forEach(hero => {
      // Reveal animations
      const anims = hero.querySelectorAll('.rt-luxury-video-hero-anim');
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            anims.forEach(anim => anim.classList.add('animate-in'));
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      revealObserver.observe(hero);

      // Handle video load / ready state
      const video = hero.querySelector('.rt-luxury-video-hero__video');
      const poster = hero.querySelector('.rt-luxury-video-hero__poster');
      if (video) {
        if (video.readyState >= 3) {
          video.classList.add('video-loaded');
          if (poster) poster.classList.add('video-ready');
        } else {
          video.addEventListener('canplay', () => {
            video.classList.add('video-loaded');
            if (poster) poster.classList.add('video-ready');
          }, { once: true });
        }
      }
    });

    // --- 4. Transparent Header Scroll Observer ---
    const firstHero = document.querySelector('.rt-luxury-video-hero-wrapper');
    const header = document.querySelector('header-component');
    if (firstHero && header) {
      document.body.classList.add('rt-transparent-header-active');
      
      const headerObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) {
            header.classList.add('header--scrolled');
          } else {
            header.classList.remove('header--scrolled');
          }
        });
      }, {
        root: null,
        threshold: 0,
        rootMargin: '-80px 0px 0px 0px'
      });
      
      headerObserver.observe(firstHero);
    } else {
      document.body.classList.remove('rt-transparent-header-active');
    }
  };

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHero);
  } else {
    initHero();
  }

  // Hook into Shopify Theme Editor reload events
  document.addEventListener('shopify:section:load', (e) => {
    initHero();
  });
})();
