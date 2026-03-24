const { body, validationResult } = require('express-validator');

const kayitOlValidationRules = [
  body('rol')
    .notEmpty()
    .withMessage('Rol boş bırakılamaz.')
    .isIn([1, 2])
    .withMessage('Rol sadece 1 veya 2 değerini alabilir.'),

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

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  
  return res.status(400).json({
    success: false,
    error: "Validation failed"
  });
};

module.exports = {
    kayitOlValidationRules,
    validate
};