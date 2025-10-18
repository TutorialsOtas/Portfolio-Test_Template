const ready = (cb) => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cb);
  } else {
    cb();
  }
};

document.documentElement.setAttribute("data-js", "enabled");

ready(() => {
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  const navAnchors = document.querySelectorAll(".nav-links a");
  const reveals = document.querySelectorAll(".reveal");
  const stats = document.querySelectorAll(".stat");
  const yearEl = document.getElementById("year");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const closeNav = () => {
    navLinks?.classList.remove("open");
    navToggle?.classList.remove("active");
    document.body.classList.remove("nav-open");
  };

  navToggle?.addEventListener("click", () => {
    const isOpen = navLinks?.classList.toggle("open") ?? false;
    if (isOpen) {
      navToggle.classList.add("active");
      document.body.classList.add("nav-open");
    } else {
      closeNav();
    }
  });

  navAnchors.forEach((anchor) => {
    anchor.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 768px)").matches) {
        closeNav();
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNav();
    }
  });

  document.addEventListener("click", (event) => {
    if (!navLinks || !navToggle) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    if (!navLinks.contains(target) && !navToggle.contains(target)) {
      closeNav();
    }
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const element = entry.target;
          element.classList.add("visible");
          observer.unobserve(element);
        }
      });
    },
    { threshold: 0.2 }
  );

  reveals.forEach((element) => observer.observe(element));

  const statObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        const el = entry.target;
        if (!(el instanceof HTMLElement)) {
          statObserver.unobserve(el);
          return;
        }
        const target = Number(el.dataset.target);
        if (!target || el.dataset.counted === "true") {
          statObserver.unobserve(el);
          return;
        }
        el.dataset.counted = "true";
        animateCount(el, target);
        statObserver.unobserve(el);
      });
    },
    { threshold: 0.6 }
  );

  stats.forEach((stat) => statObserver.observe(stat));

  const parallax = document.querySelector(".floating-shapes");
  let rafId = null;
  let pointerX = 0;
  let pointerY = 0;

  const updateParallax = () => {
    if (!(parallax instanceof HTMLElement)) {
      return;
    }
    parallax.style.transform = `translate(${pointerX * 0.02}px, ${pointerY * 0.02}px)`;
    rafId = null;
  };

  window.addEventListener("pointermove", (event) => {
    pointerX = (event.clientX - window.innerWidth / 2) * 0.6;
    pointerY = (event.clientY - window.innerHeight / 2) * 0.6;
    if (rafId === null) {
      rafId = window.requestAnimationFrame(updateParallax);
    }
  });

  const contactForm = document.getElementById("contact-form");
  const statusEl = contactForm?.querySelector(".form-status");
  const submitButton = contactForm?.querySelector('button[type="submit"]');

  if (contactForm && statusEl && submitButton) {
    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(contactForm);
      const payload = {
        name: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        project: String(formData.get("project") || "").trim()
      };

      if (!payload.name || !payload.email || !payload.project) {
        statusEl.textContent = "Please fill in all fields.";
        statusEl.classList.add("error");
        statusEl.classList.remove("success");
        return;
      }

      statusEl.textContent = "Sending...";
      statusEl.classList.remove("error", "success");
      submitButton.disabled = true;
      submitButton.classList.add("is-sending");

      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Failed to send message.");
        }

        statusEl.textContent = result.message || "Thanks for reaching out!";
        statusEl.classList.add("success");
        statusEl.classList.remove("error");
        contactForm.reset();
      } catch (error) {
        statusEl.textContent = error.message || "Unable to send message. Please try again.";
        statusEl.classList.add("error");
        statusEl.classList.remove("success");
      } finally {
        submitButton.disabled = false;
        submitButton.classList.remove("is-sending");
      }
    });
  }
});

function animateCount(element, target) {
  const duration = 1600;
  const start = performance.now();

  const step = (timestamp) => {
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = easeOutCubic(progress);
    element.textContent = String(Math.round(target * eased));
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.textContent = String(target);
    }
  };

  requestAnimationFrame(step);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
