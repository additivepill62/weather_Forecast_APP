// app.js – közös kód: beállítások, munkamenet, API-hívás, segédfüggvények, router, navigáció

// A backend címe (a .env fájl APP_PORT értéke szerint)
const API_URL = 'http://localhost:3000'

const $ = id => document.getElementById(id)


// ---------- MUNKAMENET (localStorage) ----------
const Session = {
    key: 'weatherUser',
    user(){
        try { return JSON.parse(localStorage.getItem(this.key)) } catch (e) { return null }
    },
    set(user){ localStorage.setItem(this.key, JSON.stringify(user)) },
    clear(){ localStorage.removeItem(this.key) },
    isAdmin(){
        const u = this.user()
        return !!u && u.role === 'admin'
    }
}


// ---------- TÉMA (világos / sötét) ----------
// A választás a localStorage-ben marad; ha még nem választott, a rendszer beállítását követjük.
// (A <head>-ben lévő kis script ugyanezt a kirajzolás előtt állítja be, hogy ne villanjon.)
const Theme = {
    key: 'weatherTheme',

    saved(){
        try {
            const t = localStorage.getItem(this.key)
            return (t === 'light' || t === 'dark') ? t : null
        } catch (e) { return null }
    },
    system(){
        return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    },
    current(){
        return document.documentElement.getAttribute('data-bs-theme') || 'light'
    },

    apply(theme, save){
        document.documentElement.setAttribute('data-bs-theme', theme)
        if(save){
            try { localStorage.setItem(this.key, theme) } catch (e) { /* pl. privát mód: nem menthető */ }
        }

        const btn = $('themeToggle')
        if(btn){
            const dark = theme === 'dark'
            const label = dark ? 'Váltás világos módra' : 'Váltás sötét módra'
            btn.querySelector('span').textContent = dark ? '☀️' : '🌙'
            btn.setAttribute('aria-label', label)
            btn.setAttribute('aria-pressed', String(dark))
            btn.title = label
        }
        document.dispatchEvent(new CustomEvent('themechange', {detail: theme}))
    },

    toggle(){
        this.apply(this.current() === 'dark' ? 'light' : 'dark', true)
    },

    init(){
        this.apply(this.saved() || this.system(), false)
        $('themeToggle').addEventListener('click', () => this.toggle())

        // amíg a felhasználó nem választott, kövesse a rendszer beállításának változását
        if(window.matchMedia){
            matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                if(!this.saved()) this.apply(e.matches ? 'dark' : 'light', false)
            })
        }
    }
}


// ---------- API-HÍVÁS ----------
// Mindig {ok, status, data} objektumot ad vissza, nem dob hibát.
async function api(method, path, body){
    const options = {method, headers: {}}
    if(body !== undefined){
        options.headers['Content-Type'] = 'application/json'
        options.body = JSON.stringify(body)
    }

    let res
    try {
        res = await fetch(API_URL + path, options)
    } catch (e) {
        Message.error('A szerver nem érhető el. Fut a backend?')
        return {ok: false, status: 0, data: null}
    }

    let data = null
    try { data = await res.json() } catch (e) { /* nem JSON válasz */ }

    // Ha belépés közben tiltották le a felhasználót, léptessük ki.
    if(res.status === 403 && data && data.error && data.error.includes('AuthUserBanned')){
        Session.clear()
        Message.error('A fiókodat egy adminisztrátor letiltotta.')
        location.hash = '#/login'
    }
    return {ok: res.ok, status: res.status, data}
}


// ---------- SEGÉDFÜGGVÉNYEK ----------
const WEATHER = {
    sunny:         {icon: '☀️',  label: 'Napos'},
    partly_cloudy: {icon: '⛅',  label: 'Részben felhős'},
    cloudy:        {icon: '☁️',  label: 'Felhős'},
    rainy:         {icon: '🌧️', label: 'Esős'},
    stormy:        {icon: '⛈️',  label: 'Viharos'},
    snowy:         {icon: '❄️',  label: 'Havas'},
    foggy:         {icon: '🌫️', label: 'Ködös'},
    windy:         {icon: '💨',  label: 'Szeles'}
}

// hőmérséklet → szín (hideg kék … meleg piros)
const TEMP_STOPS = [
    [-15, [91, 111, 224]], [0, [74, 155, 224]], [10, [76, 195, 164]],
    [20, [241, 185, 60]],  [30, [232, 100, 60]], [40, [196, 39, 47]]
]

const Utils = {
    // HTML-escape (XSS ellen): minden szerverről jövő szöveget ezen át írunk ki
    esc(value){
        return String(value ?? '').replace(/[&<>"']/g, c => (
            {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]
        ))
    },

    blank(v){ return v === null || v === undefined || v === '' },

    // szám magyar tizedesvesszővel, felesleges nullák nélkül
    num(v){
        if(this.blank(v)) return '–'
        return String(+Number(v).toFixed(1)).replace('.', ',')
    },
    temp(v){ return this.blank(v) ? '–' : this.num(v) + '°' },
    val(v, unit = ''){
        if(this.blank(v)) return '–'
        return (typeof v === 'number' ? this.num(v) : v) + unit
    },

    weather(type){
        const key = String(type || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
        return WEATHER[key] || {icon: '🌡️', label: type || '–'}
    },

    date(d, format = 'YYYY. MM. DD.'){
        if(!d) return '–'
        return window.moment ? moment(d).format(format) : String(d).slice(0, 10)
    },

    weekday(d){
        const names = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat']
        const dt = new Date(String(d).slice(0, 10) + 'T00:00:00')
        return isNaN(dt) ? '' : names[dt.getDay()]
    },

    // YYYY-MM-DD formátumú mai (vagy eltolt) dátum
    today(offset = 0){
        const d = new Date()
        d.setDate(d.getDate() + offset)
        const p = n => String(n).padStart(2, '0')
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
    },

    tempColor(t){
        t = Math.max(-15, Math.min(40, Number(t)))
        for(let i = 1; i < TEMP_STOPS.length; i++){
            if(t <= TEMP_STOPS[i][0]){
                const [t0, c0] = TEMP_STOPS[i - 1]
                const [t1, c1] = TEMP_STOPS[i]
                const k = (t - t0) / (t1 - t0)
                return 'rgb(' + c0.map((v, j) => Math.round(v + (c1[j] - v) * k)).join(',') + ')'
            }
        }
    },

    busy(btn, state){ if(btn) btn.disabled = state },

    debounce(fn, ms = 300){
        let timer
        return (...args) => {
            clearTimeout(timer)
            timer = setTimeout(() => fn(...args), ms)
        }
    }
}


// ---------- NAVIGÁCIÓ ----------
function renderNav(){
    const user = Session.user()
    const hash = location.hash || '#/home'
    const link = (href, text) =>
        '<li class="nav-item"><a class="nav-link ' + (hash === href ? 'active' : '') + '" href="' + href + '">' + text + '</a></li>'

    let links = link('#/home', 'Kezdőlap')
    if(user) links += link('#/forecasts', 'Előrejelzések')
    if(user && user.role === 'admin'){
        links += link('#/admin/dashboard', 'Kezelőpult') + link('#/admin/users', 'Felhasználók')
    }
    $('navLinks').innerHTML = links

    if(user){
        $('navUser').innerHTML = link('#/profile', Utils.esc(user.name)) +
            '<li class="nav-item"><button class="btn btn-sm btn-outline-dark ms-md-2" id="btnLogout" type="button">Kijelentkezés</button></li>'
        $('btnLogout').addEventListener('click', logout)
    } else {
        $('navUser').innerHTML = link('#/login', 'Bejelentkezés') +
            '<li class="nav-item"><a class="btn btn-sm btn-primary ms-md-2" href="#/register">Regisztráció</a></li>'
    }

    // mobilon link kattintás után csukódjon be a menü
    $('navMenu').querySelectorAll('a').forEach(a => a.addEventListener('click', () => $('navMenu').classList.remove('show')))
}

function logout(){
    Session.clear()
    Message.success('Kijelentkeztél.')
    if(location.hash === '#/home') navigate()
    else location.hash = '#/home'
}


// ---------- ROUTER ----------
// access: 'any' = mindenki, 'guest' = csak vendég, 'user' = bejelentkezett, 'admin' = csak admin
const ROUTES = {
    '#/home':            {view: 'views/home.html',            access: 'any',   init: () => ForecastCtrl.initHome()},
    '#/login':           {view: 'views/users/login.html',     access: 'guest', init: () => UserCtrl.initLogin()},
    '#/register':        {view: 'views/users/register.html',  access: 'guest', init: () => UserCtrl.initRegister()},
    '#/profile':         {view: 'views/users/profile.html',   access: 'user',  init: () => UserCtrl.initProfile()},
    '#/forecasts':       {view: 'views/users/forecasts.html', access: 'user',  init: () => ForecastCtrl.initForecasts()},
    '#/admin/dashboard': {view: 'views/admin/dashboard.html', access: 'admin', init: () => AdminCtrl.initDashboard()},
    '#/admin/users':     {view: 'views/admin/users.html',     access: 'admin', init: () => AdminCtrl.initUsers()}
}

let navToken = 0

async function navigate(){
    renderNav()
    const route = ROUTES[location.hash || '#/home']
    if(!route){ location.hash = '#/home'; return }

    const user = Session.user()
    if(route.access === 'guest' && user){ location.hash = '#/home'; return }
    if(route.access === 'user' && !user){
        Message.info('Az oldal megtekintéséhez jelentkezz be.')
        location.hash = '#/login'
        return
    }
    if(route.access === 'admin' && (!user || user.role !== 'admin')){
        Message.error('Ehhez az oldalhoz adminisztrátori jog kell.')
        location.hash = user ? '#/home' : '#/login'
        return
    }

    const token = ++navToken
    let html
    try {
        const res = await fetch(route.view, {cache: 'no-cache'})
        if(!res.ok) throw new Error(res.status)
        html = await res.text()
    } catch (e) {
        $('view').innerHTML = '<div class="container section"><div class="alert alert-danger">Az oldal (' +
            Utils.esc(route.view) + ') nem tölthető be. Böngészőben a fájlt dupla kattintással megnyitva nem működik – használj Live Servert vagy helyi webszervert.</div></div>'
        return
    }
    if(token !== navToken) return // közben másik oldalra léptek

    // megmaradt modal-háttér takarítása
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove())
    document.body.classList.remove('modal-open')
    document.body.style.removeProperty('overflow')
    document.body.style.removeProperty('padding-right')

    $('view').innerHTML = html
    window.scrollTo(0, 0)
    route.init()
}

window.addEventListener('hashchange', navigate)
document.addEventListener('DOMContentLoaded', () => { Theme.init(); navigate() })
