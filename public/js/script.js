document.addEventListener('DOMContentLoaded', function() {
  

  // Validação de formulários
  function setupFormValidation() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      form.addEventListener('submit', function(e) {
        if (!this.checkValidity()) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.classList.add('was-validated');
      }, false);
    });
  }

  

  // Inicializa todas as funções
  setupPasswordToggle();
  setupFormValidation();
});