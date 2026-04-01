const { body, validationResult } = require('express-validator');

const kayitOlValidationRules = [
  body('rol')
    .notEmpty()
    .withMessage('Rol boş bırakılamaz.')
    .isIn(['customer', 'cleaner'])
    .withMessage('Geçersiz rol seçimi. Sadece customer veya cleaner olabilir.'),

  body('adSoyad')
    .notEmpty()
    .withMessage('Kullanıcı adı boş bırakılamaz.')
    .trim(),

  body('email')
    .isEmail()
    .withMessage('Geçerli bir e-posta adresi giriniz.')
    .normalizeEmail(),

  body('telefon')
    .notEmpty()
    .isMobilePhone('tr-TR')
    .withMessage('Geçerli bir telefon giriniz.'),
  
  body('sifre')
    .isLength({ min: 8, max: 18 })
    .withMessage('Şifre en az 8 en fazla 18 karakter olmalıdır.')
];

const girisYapValidationRules = [
  body('email')
    .isEmail()
    .withMessage('Geçerli bir e-posta adresi giriniz.')
    .normalizeEmail(),

  body('sifre')
    .isLength({ min: 8, max: 18 })
    .withMessage('Şifre en az 8 en fazla 18 karakter olmalıdır.')
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  
  return res.status(400).json({
    success: false,
    message: "Bilgiler geçersiz!"
  });
};

module.exports = {
    kayitOlValidationRules,
    girisYapValidationRules,
    validate
};