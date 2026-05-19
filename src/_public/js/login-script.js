$(function() {
  var $form = $('#adminLoginForm');

  if (!$form.length) {
    return;
  }

  $form.on('submit', function(event) {
    event.preventDefault();

    var payload = {
      email: $('#inputEmail').val(),
      password: $('#inputPassword').val()
    };

    $.ajax({
      url: $form.attr('action'),
      method: $form.attr('method') || 'post',
      data: payload,
      dataType: 'json'
    })
    .done(function(response) {
      if (response && response.success) {
        window.location.href = response.redirect || '/home';
      } else {
        alert(response.message || 'Giriş başarısız');
      }
    })
    .fail(function(jqXHR) {
      var response = jqXHR.responseJSON || {};
      alert(response.message || 'Sunucu hatası. Lütfen tekrar deneyin.');
    });
  });
});