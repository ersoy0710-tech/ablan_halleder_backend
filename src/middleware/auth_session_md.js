const authSessionCheck = (req, res, next) => {
    if (!req.session.user) {
        if (process.env.NODE_ENV !== 'production') {
            req.session.user = {
                id: '1087543b-68c5-48a7-acb1-2b6675ce92a7',
                email: 'admin@ablanhalleder.com',
                full_name: 'Vedat Ersoy',
                phone: '5454541247'
            };
            return next();
        }

        return res.redirect('/login');
    }

    next();
};

module.exports = authSessionCheck;
