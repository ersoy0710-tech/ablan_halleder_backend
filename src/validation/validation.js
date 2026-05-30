const { body, validationResult } = require('express-validator');

const adresEkleValidationRules = [
  body('baslik')
    .trim()
    .notEmpty()
    .withMessage('Başlık boş bırakılamaz.')
    .isLength({ max: 100 })
    .withMessage('Başlık en fazla 100 karakter olabilir.'),

  body('adres')
    .trim()
    .notEmpty()
    .withMessage('Açık adres alanı boş bırakılamaz.')
    .isLength({ min: 10, max: 500 })
    .withMessage('Adres çok kısa veya çok uzun (10-500 karakter).'),

  body('ilId')
    .notEmpty()
    .withMessage('İl seçimi zorunludur.')
    .isInt({ min: 1 })
    .withMessage('Geçerli bir il giriniz.'),

  body('ilceId')
    .notEmpty()
    .withMessage('İlçe seçimi zorunludur.')
    .isInt({ min: 1 })
    .withMessage('Geçerli bir ilçe giriniz.')
]

const adreslerimValidationRules = [
]

const adresSilValidationRules = [
  body('adresId')
    .isUUID()
    .withMessage('Geçerli bir adres giriniz.'),
]

const islerValidationRules = [
]

const aktifIsValidationRules = [
]

const isiAlValidationRules = [
  body('talepId')
    .isUUID()
    .withMessage('Geçerli bir talep giriniz.'),
]

const isiIptalEtValidationRules = [
]

const temizligeBaslaValidationRules = [
]

const temizligiBitirValidationRules = [
  body('temizlikciNotu')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Temizlikçi notu en fazla 1000 karakter olabilir."),
]

const taleplerimValidationRules = [
]

const talepDetayValidationRules = [
  body('talepId')
    .isUUID()
    .withMessage('Geçerli bir talep giriniz.'),
]

const talepIptalValidationRules = [
  body('talepId')
    .isUUID()
    .withMessage('Geçerli bir talep giriniz.')
]

const talebiKapatValidationRules = [
  body('talepId')
    .isUUID()
    .withMessage('Geçerli bir talep giriniz.'),

  body('isApproved')
    .isBoolean().withMessage('Onay durumu geçersiz'),

  body('rating')
    .custom((value, { req }) => {
        if (req.body.isApproved === true) {
            if (!Number.isInteger(value) || value < 1 || value > 5) {
                throw new Error('Onay durumunda 1 ile 5 arasında bir değerlendirme zorunludur.');
            }
        }
        return true;
    }),

  body('comment')
      .optional()
      .trim()
      .isLength({ max: 1000 }).withMessage('Müşteri yorumu en fazla 1000 karakter olabilir.'),

  body('disputeReason')
    .custom((value, { req }) => {
        if (req.body.isApproved === false) {
            if (!value || value.trim().length === 0) {
                throw new Error('Temizliği reddederken itiraz sebebi belirtmek zorunludur.');
            }
            if (value.trim().length > 2000) {
                throw new Error('İtiraz sebebi en fazla 2000 karakter olabilir.');
            }
        }
        return true;
    })
]

const talepOlusturValidationRules = [
  body('adresId')
    .isUUID()
    .withMessage('Geçerli bir adres giriniz.'),

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

  body('fiyat')
    .isInt({ min: 1 })
    .withMessage('Fiyat 0\'dan büyük bir değer olmalıdır.'),

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

const adminGirisYapValidationRules = [
  body('email')
    .isEmail()
    .withMessage('Geçerli bir e-posta adresi giriniz.')
    .normalizeEmail(),

  body('password')
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
    adresEkleValidationRules,
    adreslerimValidationRules,
    adresSilValidationRules,

    islerValidationRules,
    aktifIsValidationRules,
    isiAlValidationRules,
    isiIptalEtValidationRules,
    temizligeBaslaValidationRules,
    temizligiBitirValidationRules,

    taleplerimValidationRules,
    talepDetayValidationRules,
    talepOlusturValidationRules,
    talepIptalValidationRules,
    talebiKapatValidationRules,

    kayitOlValidationRules,
    girisYapValidationRules,

    adminGirisYapValidationRules,
    validate
};