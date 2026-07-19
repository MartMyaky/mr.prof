/* ============================================================
   Portal Professores do Paraná — Script Compartilhado
   Navegação responsiva, animações e interatividade
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  // --- Menu Hamburger (Mobile) ---
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      navLinks.classList.toggle("active");
      const isOpen = navLinks.classList.contains("active");
      navToggle.setAttribute("aria-expanded", isOpen);
      navToggle.textContent = isOpen ? "\u2715" : "\u2630";
    });

    // Fechar menu ao clicar em um link
    navLinks.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        navToggle.textContent = "\u2630";
      });
    });
  }

  // --- Animação de entrada dos cards ---
  const animateOnScroll = () => {
    const elements = document.querySelectorAll(".pagebtn, section");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animation = "fadeInUp 0.5s ease-out forwards";
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    elements.forEach((el, i) => {
      el.style.opacity = "0";
      el.style.animationDelay = `${i * 0.05}s`;
      observer.observe(el);
    });
  };

  animateOnScroll();

  // --- Indicador de página ativa na navegação ---
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const navItems = document.querySelectorAll(".nav-links a");
  navItems.forEach(item => {
    const href = item.getAttribute("href");
    if (href && currentPage.includes(href.replace(".html", ""))) {
      item.style.color = "#2dd4bf";
      item.style.borderBottom = "3px solid #2dd4bf";
    }
  });

  // --- Smooth scroll para links internos ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", (e) => {
      const target = document.querySelector(anchor.getAttribute("href"));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

});
