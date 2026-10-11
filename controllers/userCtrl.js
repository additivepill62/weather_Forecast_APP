// userCtrl.js – bejelentkezés, regisztráció, profil, jelszóváltoztatás

const PWD_REGEXP = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/ // ugyanaz, mint a backendben
const EMAIL_REGEXP = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const UserCtrl = {

    // ---------- BEJELENTKEZÉS ----------
    initLogin(){
        const form = $('loginForm')
        const btn = form.querySelector('button[type=submit]')

        form.addEventListener('submit', async e => {
            e.preventDefault()
            Message.inline('loginAlert', 'danger', '')
            form.classList.add('was-validated')
            if(!form.checkValidity()) return

            Utils.busy(btn, true)
            const res = await api('POST', '/users/login', {
                email: $('loginEmail').value.trim(),
                password: $('loginPassword').value
            })
            Utils.busy(btn, false)

            if(!res.ok){
                Message.inline('loginAlert', 'danger', Message.of(res))
                return
            }

            const user = res.data.loggedUser
            Session.set(user)
            Message.success('Üdv, ' + user.name + '!')
            location.hash = user.role === 'admin' ? '#/admin/dashboard' : '#/forecasts'
        })
    },

    // ---------- REGISZTRÁCIÓ ----------
    initRegister(){
        const form = $('registerForm')
        const btn = form.querySelector('button[type=submit]')
        const pwd = $('regPassword')
        const confirm = $('regConfirm')

        // az egyedi szabályokat a böngésző saját validációján keresztül jelezzük
        const checkRules = () => {
            pwd.setCustomValidity(PWD_REGEXP.test(pwd.value) ? '' : 'weak')
            confirm.setCustomValidity(confirm.value === pwd.value ? '' : 'mismatch')
        }
        pwd.addEventListener('input', checkRules)
        confirm.addEventListener('input', checkRules)

        form.addEventListener('submit', async e => {
            e.preventDefault()
            Message.inline('registerAlert', 'danger', '')
            checkRules()
            if(!EMAIL_REGEXP.test($('regEmail').value.trim())) $('regEmail').setCustomValidity('invalid')
            else $('regEmail').setCustomValidity('')
            form.classList.add('was-validated')
            if(!form.checkValidity()) return

            Utils.busy(btn, true)
            const res = await api('POST', '/users/register', {
                name: $('regName').value.trim(),
                email: $('regEmail').value.trim(),
                password: pwd.value,
                confirm: confirm.value
            })
            Utils.busy(btn, false)

            if(!res.ok){
                Message.inline('registerAlert', 'danger', Message.of(res))
                return
            }
            Message.success(Message.of(res))
            location.hash = '#/login'
        })
    },

    // ---------- PROFIL ----------
    async initProfile(){
        const user = Session.user()

        const res = await api('GET', '/users/' + user.ID + '?luid=' + user.ID)
        if(res.ok){
            const p = res.data.results
            $('pTitle').textContent = p.name
            $('pRole').textContent = p.role === 'admin' ? 'Adminisztrátor' : 'Felhasználó'
            $('pReg').textContent = Utils.date(p.reg, 'YYYY. MM. DD.')
            $('pLast').textContent = Utils.date(p.last, 'YYYY. MM. DD. HH:mm')
            $('pCount').textContent = p.loginCount
            $('pNameInput').value = p.name
            $('pEmailInput').value = p.email
        } else if(res.status){
            Message.inline('profileAlert', 'danger', Message.of(res))
        }

        this.initProfileForm(user)
        this.initPasswordForm(user)
    },

    initProfileForm(user){
        const form = $('profileForm')
        const btn = form.querySelector('button[type=submit]')

        form.addEventListener('submit', async e => {
            e.preventDefault()
            Message.inline('profileAlert', 'danger', '')
            const email = $('pEmailInput')
            email.setCustomValidity(EMAIL_REGEXP.test(email.value.trim()) ? '' : 'invalid')
            form.classList.add('was-validated')
            if(!form.checkValidity()) return

            const name = $('pNameInput').value.trim()
            Utils.busy(btn, true)
            const res = await api('PATCH', '/users/' + user.ID, {luid: user.ID, name: name, email: email.value.trim()})
            Utils.busy(btn, false)

            if(!res.ok){
                Message.inline('profileAlert', 'danger', Message.of(res))
                return
            }
            Session.set(Object.assign({}, user, {name: name, email: email.value.trim()}))
            renderNav()
            $('pTitle').textContent = name
            form.classList.remove('was-validated')
            Message.success(Message.of(res))
        })
    },

    initPasswordForm(user){
        const form = $('passwordForm')
        const btn = form.querySelector('button[type=submit]')
        const oldPw = $('pwOld'), newPw = $('pwNew'), confirm = $('pwConfirm')

        const checkRules = () => {
            let msg = ''
            if(!PWD_REGEXP.test(newPw.value)) msg = 'Az új jelszó nem felel meg a feltételeknek.'
            else if(newPw.value === oldPw.value) msg = 'Az új jelszó nem egyezhet a jelenlegivel.'
            newPw.setCustomValidity(msg)
            $('pwNewFeedback').textContent = msg || 'Az új jelszó nem felel meg a feltételeknek.'
            confirm.setCustomValidity(confirm.value === newPw.value ? '' : 'mismatch')
        }
        ;[oldPw, newPw, confirm].forEach(el => el.addEventListener('input', checkRules))

        form.addEventListener('submit', async e => {
            e.preventDefault()
            Message.inline('passwordAlert', 'danger', '')
            checkRules()
            form.classList.add('was-validated')
            if(!form.checkValidity()) return

            Utils.busy(btn, true)
            const res = await api('POST', '/users/' + user.ID + '/changepassword', {
                luid: user.ID,
                oldpass: oldPw.value,
                newpass: newPw.value,
                confirm: confirm.value
            })
            Utils.busy(btn, false)

            if(!res.ok){
                Message.inline('passwordAlert', 'danger', Message.of(res))
                return
            }
            form.reset()
            form.classList.remove('was-validated')
            Message.success(Message.of(res))
        })
    }
}
