const { body, validationResult } = require('express-validator');

const adreslerimValidationRules = [
  body('musteriId')
    .isUUID()
    .withMessage('Geçerli bir müşteri ID formatı giriniz.'),
]

const talepOlusturValidationRules = [
  body('musteriId')
    .isUUID()
    .withMessage('Geçerli bir müşteri ID formatı giriniz.'),
  
  body('adresId')
    .isUUID()
    .withMessage('Geçerli bir adres ID formatı giriniz.'),

  body('baslik')
    .trim()
    .notEmpty()
    .withMessage('Başlık boş bırakılamaz.')
    .isLength({ max: 100 })
    .withMessage('Başlık en fazla 100 karakter olabilir.'),

  body('aciklama')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Açıklama çok uzun (Maksimum 1000 karakter).'),

  body('alan')
    .isInt({ min: 1 })
    .withMessage('Alan (m²) 0\'dan büyük bir sayı olmalıdır.'),

  body('petVarMi')
    .isBoolean()
    .withMessage('Evcil hayvan bilgisi true veya false olmalıdır.'),

  body('planlananTarih')
    .isISO8601()
    .withMessage('Geçerli bir başlangıç tarihi giriniz (ISO8601 formatında).')
    .toDate()
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error('Başlangıç tarihi geçmiş bir zaman olamaz.');
      }
      return true;
    }),
]

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
    adreslerimValidationRules,
    talepOlusturValidationRules,
    kayitOlValidationRules,
    girisYapValidationRules,
    validate
};