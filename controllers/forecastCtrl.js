// forecastCtrl.js – előrejelzések megjelenítése (vendég kezdőlap + bejelentkezett lista, részletek, grafikon)

const ForecastCtrl = {

    list: [],           // a "Előrejelzések" oldalon betöltött lista
    chart: null,        // Chart.js példány

    // ---------- KÖZÖS RÉSZEK ----------

    // a megjelenített sorokhoz közös hőmérséklet-skála, hogy a sávok összehasonlíthatók legyenek
    scale(list){
        let lo = Math.min(...list.map(f => f.temp_min))
        let hi = Math.max(...list.map(f => f.temp_max))
        lo = Math.floor(lo) - 2
        hi = Math.ceil(hi) + 2
        return {lo, hi}
    },

    rangeHtml(f, sc){
        const span = (sc.hi - sc.lo) || 1
        const left = Math.max(0, (f.temp_min - sc.lo) / span * 100)
        const width = Math.min(100 - left, Math.max((f.temp_max - f.temp_min) / span * 100, 2.5))
        const fill = 'linear-gradient(90deg,' + Utils.tempColor(f.temp_min) + ',' + Utils.tempColor(f.temp_max) + ')'
        return '<div class="fc-range">' +
                   '<span class="t-min" title="Minimum">' + Utils.temp(f.temp_min) + '</span>' +
                   '<div class="range-track"><span class="range-fill" style="left:' + left.toFixed(1) + '%;width:' + width.toFixed(1) + '%;background:' + fill + '"></span></div>' +
                   '<span class="t-max" title="Maximum">' + Utils.temp(f.temp_max) + '</span>' +
               '</div>'
    },

    // egy előrejelzés-sor. sub = a hely neve alatti kis szöveg; clickable = gombként viselkedik
    rowHtml(f, sc, sub, clickable){
        const w = Utils.weather(f.weather_type)
        const tag = clickable ? 'button type="button" data-id="' + f.ID + '"' : 'div'
        const end = clickable ? 'button' : 'div'
        return '<' + tag + ' class="fc-row">' +
                   '<span class="fc-icon" aria-hidden="true">' + w.icon + '</span>' +
                   '<span><span class="fc-place d-block">' + Utils.esc(f.location) + '</span>' +
                   '<span class="fc-sub">' + Utils.esc(sub) + '</span></span>' +
                   this.rangeHtml(f, sc) +
               '</' + end + '>'
    },

    emptyHtml(title, text){
        return '<div class="empty"><strong>' + Utils.esc(title) + '</strong>' + Utils.esc(text) + '</div>'
    },

    // ---------- KEZDŐLAP (vendég is látja) ----------
    initHome(){
        const dateEl = $('homeDate'), locEl = $('homeLocation')
        dateEl.value = ''

        const load = async () => {
            const params = new URLSearchParams()
            if(dateEl.value) params.set('date', dateEl.value)
            if(locEl.value.trim()) params.set('location', locEl.value.trim())

            const res = await api('GET', '/forecasts?' + params.toString())
            const box = $('homeList')
            if(!res.ok){
                box.innerHTML = this.emptyHtml('Az előrejelzések nem tölthetők be.', 'Próbáld újra később.')
                return
            }

            const list = res.data.results
            if(list.length === 0){
                box.innerHTML = this.emptyHtml('Erre a napra nincs előrejelzés.', 'Válassz másik napot, vagy töröld a helyszín-szűrőt.')
                return
            }
            const sc = this.scale(list)
            box.innerHTML = '<div class="fc-list">' +
                list.map(f => this.rowHtml(f, sc, Utils.weather(f.weather_type).label, false)).join('') +
                '</div>'
        }

        dateEl.addEventListener('change', load)
        locEl.addEventListener('input', Utils.debounce(load))
        $('homeToday').addEventListener('click', () => { dateEl.value = Utils.today(); load() })
        $('homeTomorrow').addEventListener('click', () => { dateEl.value = Utils.today(1); load() })

        // felhívás a bejelentkezésre / a részletes oldalra
        $('homeCta').innerHTML = Session.user()
            ? '<strong>Részletes adatokat is találsz.</strong><div class="text-muted mb-2">Csapadék, szél, páratartalom, légnyomás és UV-index minden napra.</div><a class="btn btn-primary" href="#/forecasts">Előrejelzések megnyitása</a>'
            : '<strong>Több adatra van szükséged?</strong><div class="text-muted mb-2">Bejelentkezve látod a csapadékot, a szelet, a páratartalmat, a légnyomást és az UV-indexet is.</div><a class="btn btn-primary me-2" href="#/login">Bejelentkezés</a><a class="btn btn-outline-dark" href="#/register">Regisztráció</a>'

        load()
    },

    // ---------- ELŐREJELZÉSEK (bejelentkezett user / admin) ----------
    initForecasts(){
        const user = Session.user()
        const dateEl = $('fcDate'), locEl = $('fcLocation')

        const load = async () => {
            const body = {luid: user.ID}
            if(dateEl.value) body.date = dateEl.value
            if(locEl.value.trim()) body.location = locEl.value.trim()

            const res = await api('POST', '/forecasts/all', body)
            if(!res.ok){
                $('fcList').innerHTML = this.emptyHtml('Az előrejelzések nem tölthetők be.', Message.of(res) || 'Próbáld újra később.')
                return
            }
            this.list = res.data.results
            this.renderGroups()
            this.renderChart()
        }

        dateEl.addEventListener('change', load)
        locEl.addEventListener('input', Utils.debounce(load))
        $('fcReset').addEventListener('click', () => { dateEl.value = ''; locEl.value = ''; load() })
        $('fcList').addEventListener('click', e => {
            const row = e.target.closest('[data-id]')
            if(row) this.showDetails(row.dataset.id)
        })
        $('chartPlace').addEventListener('change', e => this.drawChart(e.target.value))

        load()
    },

    // napok szerint csoportosított lista
    renderGroups(){
        const box = $('fcList')
        if(this.list.length === 0){
            box.innerHTML = this.emptyHtml('Nincs a szűrésnek megfelelő előrejelzés.', 'Módosítsd a szűrőket.')
            return
        }

        const sc = this.scale(this.list)
        const days = new Map()
        this.list.forEach(f => {
            if(!days.has(f.date)) days.set(f.date, [])
            days.get(f.date).push(f)
        })

        let html = ''
        days.forEach((items, date) => {
            html += '<div class="fc-day"><h2>' + Utils.date(date) + '</h2><span>' + Utils.weekday(date) + '</span></div><div class="fc-list">'
            html += items.map(f => {
                let sub = Utils.weather(f.weather_type).label
                if(!Utils.blank(f.precipitation_probability)) sub += ', ' + f.precipitation_probability + '% eséllyel csapadék'
                return this.rowHtml(f, sc, sub, true)
            }).join('')
            html += '</div>'
        })
        box.innerHTML = html
    },

    // egy nap részletei
    async showDetails(id){
        const user = Session.user()
        const res = await api('POST', '/forecasts/' + id + '/details', {luid: user.ID})
        if(!res.ok){
            Message.error(Message.of(res) || 'A részletek nem tölthetők be.')
            return
        }

        const f = res.data.results
        const w = Utils.weather(f.weather_type)
        const metrics = [
            ['Csapadék',             Utils.val(f.precipitation, ' mm')],
            ['Csapadék esélye',      Utils.val(f.precipitation_probability, ' %')],
            ['Szélsebesség',         Utils.val(f.wind_speed, ' km/h')],
            ['Szélirány',            Utils.val(f.wind_direction)],
            ['Páratartalom',         Utils.val(f.humidity, ' %')],
            ['Légnyomás',            Utils.val(f.pressure, ' hPa')],
            ['UV-index',             Utils.val(f.uv_index)]
        ]

        $('detailTitle').textContent = f.location
        $('detailBody').innerHTML =
            '<p class="text-muted mb-3">' + Utils.date(f.date) + ', ' + Utils.weekday(f.date) + '</p>' +
            '<div class="detail-hero"><span class="detail-icon" aria-hidden="true">' + w.icon + '</span>' +
                '<div><div class="detail-type">' + Utils.esc(w.label) + '</div>' +
                '<div class="detail-temps">' + Utils.temp(f.temp_min) + ' és ' + Utils.temp(f.temp_max) + ' között</div></div></div>' +
            this.rangeHtml(f, {lo: f.temp_min - 6, hi: f.temp_max + 6}) +
            '<div class="metric-grid">' +
                metrics.map(m => '<div class="metric"><small>' + m[0] + '</small><b>' + Utils.esc(m[1]) + '</b></div>').join('') +
            '</div>' +
            '<p class="small text-muted mt-3 mb-0">Utoljára módosítva: ' + Utils.date(f.updated_at, 'YYYY. MM. DD. HH:mm') + '</p>'

        bootstrap.Modal.getOrCreateInstance($('detailModal')).show()
    },

    // ---------- GRAFIKON (Chart.js, opcionális) ----------
    renderChart(){
        const box = $('chartBox')
        if(!window.Chart || this.list.length === 0){
            box.classList.add('d-none')
            return
        }
        const places = [...new Set(this.list.map(f => f.location))]
        const select = $('chartPlace')
        const previous = select.value
        select.innerHTML = places.map(p => '<option>' + Utils.esc(p) + '</option>').join('')
        select.value = places.includes(previous) ? previous : places[0]

        box.classList.remove('d-none')
        this.drawChart(select.value)
    },

    // a grafikon színei a téma aktuális értékeiből jönnek
    chartColors(){
        const css = getComputedStyle(document.documentElement)
        return {text: css.getPropertyValue('--muted').trim(), grid: css.getPropertyValue('--line').trim()}
    },

    drawChart(place){
        const rows = this.list.filter(f => f.location === place)
        const c = this.chartColors()
        if(this.chart) this.chart.destroy()

        this.chart = new Chart($('tempChart'), {
            type: 'line',
            data: {
                labels: rows.map(f => Utils.date(f.date, 'MM. DD.')),
                datasets: [
                    {label: 'Maximum', data: rows.map(f => f.temp_max), borderColor: '#e8643c', backgroundColor: '#e8643c', tension: .3},
                    {label: 'Minimum', data: rows.map(f => f.temp_min), borderColor: '#4a9be0', backgroundColor: '#4a9be0', tension: .3}
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {legend: {position: 'bottom', labels: {color: c.text}}},
                scales: {
                    x: {ticks: {color: c.text}, grid: {color: c.grid}},
                    y: {ticks: {color: c.text, callback: v => v + '°'}, grid: {color: c.grid}}
                }
            }
        })
    }
}

// témaváltáskor a grafikont újrarajzoljuk az új színekkel
document.addEventListener('themechange', () => {
    if(ForecastCtrl.chart && $('tempChart') && $('chartPlace') && $('chartPlace').value){
        ForecastCtrl.drawChart($('chartPlace').value)
    }
})
