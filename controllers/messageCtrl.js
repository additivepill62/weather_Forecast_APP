// messageCtrl.js – értesítések (toast) és űrlap-hibák kezelése
// A backend [TAG] üzeneteit magyarra fordítja; ami nincs a szótárban, azt az eredeti szöveggel (a címke nélkül) mutatja.

const Message = {

    dict: {
        // bejelentkezés / regisztráció
        LOGINSuccess:                 'Sikeres bejelentkezés.',
        LOGINCredentialsError:        'Hibás e-mail cím vagy jelszó.',
        LOGINUserHasBeenBanned:       'A fiókodat egy adminisztrátor letiltotta.',
        REGISTERDBInsertSuccess:      'Sikeres regisztráció! Most már bejelentkezhetsz.',
        REGISTEREmailCheckExistError: 'Ezzel az e-mail címmel már regisztráltak.',
        REGISTEREmailFormat:          'Érvénytelen e-mail cím.',
        REGISTERRegexError:           'A jelszó túl gyenge.',
        REGISTERPasswordMatch:        'A két jelszó nem egyezik.',
        // profil
        PATCHUserUpdateSuccess:       'A profilod frissült.',
        PATCHUserDataUnchanged:       'Nem volt mit módosítani.',
        PATCHEmailInUse:              'Ez az e-mail cím már foglalt.',
        PATCHUserEmailFormat:         'Érvénytelen e-mail cím.',
        CHANGEPWUpdateSuccess:        'A jelszavad megváltozott.',
        CHANGEPWOldIncorrect:         'A régi jelszó nem helyes.',
        CHANGEPWOldMatchError:        'Az új jelszó nem egyezhet a régivel.',
        CHANGEPWRegexError:           'Az új jelszó túl gyenge.',
        CHANGEPWConfirmMatchError:    'Az új jelszó és a megerősítés nem egyezik.',
        // előrejelzések
        CREATEForecastSuccess:        'Az előrejelzés felvéve.',
        UPDATEForecastSuccess:        'Az előrejelzés módosítva.',
        DELETEForecastSuccess:        'Az előrejelzés törölve.',
        CREATEForecastExists:         'Erre a helyre és napra már van előrejelzés.',
        UPDATEForecastExists:         'Erre a helyre és napra már van előrejelzés.',
        FORECASTDateError:            'Érvénytelen dátum (ÉÉÉÉ-HH-NN formátum kell).',
        FORECASTTempError:            'A minimum hőmérséklet nem lehet magasabb a maximumnál.',
        FORECASTMissingFields:        'A dátum, helyszín, minimum, maximum és időjárás-típus kötelező.',
        // admin
        POSTUserBanned:               'A felhasználó letiltva.',
        POSTUserUnbanned:             'A letiltás feloldva.',
        POSTDenyUserAdminProtected:   'Másik adminisztrátort nem lehet letiltani.'
    },

    // "[TAG] szöveg" → olvasható szöveg
    text(raw){
        if(!raw) return ''
        const m = String(raw).match(/^\[([^\]]+)\]\s*(.*)$/)
        if(!m) return String(raw)
        return this.dict[m[1]] || m[2]
    },

    // az api() válaszából a megjeleníthető szöveg (hiba vagy üzenet)
    of(res){
        if(!res || !res.data) return ''
        return this.text(res.data.error || res.data.message)
    },

    toast(type, text){
        const box = document.getElementById('toastBox')
        if(!text) return
        if(!box || !window.bootstrap){ alert(text); return }

        const el = document.createElement('div')
        el.className = 'toast align-items-center border-0 text-bg-' + type
        el.setAttribute('role', type === 'danger' ? 'alert' : 'status')
        el.innerHTML = '<div class="d-flex"><div class="toast-body"></div>' +
                       '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Bezár"></button></div>'
        el.querySelector('.toast-body').textContent = text
        box.appendChild(el)

        el.addEventListener('hidden.bs.toast', () => el.remove())
        new bootstrap.Toast(el, {delay: 4500}).show()
    },

    success(text){ this.toast('success', text) },
    error(text){   this.toast('danger',  text) },
    info(text){    this.toast('dark',    text) },

    // űrlap feletti figyelmeztetés (id = az üres <div> azonosítója); üres szöveg törli
    inline(id, type, text){
        const el = document.getElementById(id)
        if(!el) return
        if(!text){ el.innerHTML = ''; return }
        el.innerHTML = '<div class="alert alert-' + type + ' py-2 mb-3" role="alert"></div>'
        el.firstChild.textContent = text
    }
}
