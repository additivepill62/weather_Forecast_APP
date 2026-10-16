// adminCtrl.js – adminisztrátori oldalak: előrejelzések kezelése, felhasználók listája és tiltása

const AdminCtrl = {

    forecasts: [],
    users: [],

    // az űrlap mezői: [backend mező, input azonosítója]
    formFields: [
        ['date', 'fDate'], ['location', 'fLocation'], ['temp_min', 'fTempMin'], ['temp_max', 'fTempMax'],
        ['weather_type', 'fType'], ['precipitation', 'fPrecip'], ['precipitation_probability', 'fProb'],
        ['humidity', 'fHumidity'], ['wind_speed', 'fWind'], ['wind_direction', 'fWindDir'],
        ['pressure', 'fPressure'], ['uv_index', 'fUv']
    ],

    // ================= KEZELŐPULT =================
    initDashboard(){
        const admin = Session.user()
        let editId = null      // null = új előrejelzés
        let deleteId = null

        const formModal = bootstrap.Modal.getOrCreateInstance($('forecastModal'))
        const deleteModal = bootstrap.Modal.getOrCreateInstance($('deleteModal'))
        const form = $('forecastForm')

        const load = async () => {
            const res = await api('POST', '/admin/forecasts/list', {luid: admin.ID})
            if(!res.ok){
                $('dashSummary').textContent = 'Az előrejelzések nem tölthetők be.'
                return
            }
            this.forecasts = res.data.results
            const places = new Set(this.forecasts.map(f => f.location)).size
            $('dashSummary').textContent = this.forecasts.length + ' előrejelzés, ' + places + ' helyszín.'
            render()
        }

        const render = () => {
            const q = $('dashSearch').value.trim().toLowerCase()
            const rows = this.forecasts.filter(f =>
                !q || (f.location + ' ' + f.date + ' ' + f.weather_type + ' ' + Utils.weather(f.weather_type).label).toLowerCase().includes(q))

            if(rows.length === 0){
                $('dashBody').innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Nincs megjeleníthető előrejelzés.</td></tr>'
                return
            }
            $('dashBody').innerHTML = rows.map(f => {
                const w = Utils.weather(f.weather_type)
                return '<tr>' +
                    '<td class="text-nowrap">' + Utils.date(f.date) + '<div class="small text-muted">' + Utils.weekday(f.date) + '</div></td>' +
                    '<td class="fw-semibold">' + Utils.esc(f.location) + '</td>' +
                    '<td>' + Utils.temp(f.temp_min) + '</td>' +
                    '<td class="fw-semibold">' + Utils.temp(f.temp_max) + '</td>' +
                    '<td class="text-nowrap"><span aria-hidden="true">' + w.icon + '</span> ' + Utils.esc(w.label) + '</td>' +
                    '<td>' + Utils.val(f.precipitation_probability, ' %') + '</td>' +
                    '<td class="text-nowrap">' + Utils.val(f.wind_speed, ' km/h') + ' ' + Utils.esc(f.wind_direction || '') + '</td>' +
                    '<td class="text-end text-nowrap">' +
                        '<button type="button" class="btn btn-sm btn-outline-dark me-1" data-edit="' + f.ID + '">Szerkesztés</button>' +
                        '<button type="button" class="btn btn-sm btn-outline-danger" data-del="' + f.ID + '">Törlés</button>' +
                    '</td></tr>'
            }).join('')
        }

        // ----- új / szerkesztés -----
        const openForm = forecast => {
            editId = forecast ? forecast.ID : null
            form.classList.remove('was-validated')
            Message.inline('forecastAlert', 'danger', '')
            $('forecastModalTitle').textContent = forecast ? 'Előrejelzés szerkesztése' : 'Új előrejelzés'
            this.formFields.forEach(([field, id]) => {
                $(id).value = forecast && !Utils.blank(forecast[field]) ? forecast[field] : ''
            })
            if(!forecast) $('fDate').value = Utils.today()
            formModal.show()
        }

        $('btnNew').addEventListener('click', () => openForm(null))

        form.addEventListener('submit', async e => {
            e.preventDefault()
            Message.inline('forecastAlert', 'danger', '')
            form.classList.add('was-validated')
            if(!form.checkValidity()) return

            const body = {luid: admin.ID}
            this.formFields.forEach(([field, id]) => { body[field] = $(id).value.trim() })

            const btn = $('forecastSave')
            Utils.busy(btn, true)
            const res = editId
                ? await api('PATCH', '/admin/forecasts/' + editId, body)
                : await api('POST', '/admin/forecasts', body)
            Utils.busy(btn, false)

            if(!res.ok){
                Message.inline('forecastAlert', 'danger', Message.of(res))
                return
            }
            formModal.hide()
            Message.success(Message.of(res))
            load()
        })

        // ----- törlés -----
        $('dashBody').addEventListener('click', e => {
            const editBtn = e.target.closest('[data-edit]')
            const delBtn = e.target.closest('[data-del]')

            if(editBtn){
                openForm(this.forecasts.find(f => f.ID == editBtn.dataset.edit))
            } else if(delBtn){
                const f = this.forecasts.find(x => x.ID == delBtn.dataset.del)
                deleteId = f.ID
                $('deleteText').textContent = 'Biztosan törlöd ezt az előrejelzést: ' + f.location + ', ' + Utils.date(f.date) + '? A művelet nem vonható vissza.'
                deleteModal.show()
            }
        })

        $('deleteConfirm').addEventListener('click', async () => {
            const btn = $('deleteConfirm')
            Utils.busy(btn, true)
            const res = await api('DELETE', '/admin/forecasts/' + deleteId, {luid: admin.ID})
            Utils.busy(btn, false)
            deleteModal.hide()

            if(!res.ok){
                Message.error(Message.of(res))
                return
            }
            Message.success(Message.of(res))
            load()
        })

        $('dashSearch').addEventListener('input', render)
        load()
    },

    // ================= FELHASZNÁLÓK =================
    initUsers(){
        const admin = Session.user()
        let target = null
        const banModal = bootstrap.Modal.getOrCreateInstance($('banModal'))

        const load = async () => {
            const res = await api('POST', '/admin/users', {luid: admin.ID})
            if(!res.ok){
                $('usersSummary').textContent = 'A felhasználók nem tölthetők be.'
                return
            }
            this.users = res.data
            const banned = this.users.filter(u => u.status == 0).length
            const adminCount = this.users.filter(u => u.role == 'admin').length
            $('usersSummary').textContent = this.users.length + ' felhasználó, ebből ' + banned + ' letiltva, '+adminCount  + ' admin'
            render()
        }

        const render = () => {
            const q = $('usersSearch').value.trim().toLowerCase()
            const rows = this.users.filter(u => !q || (u.name + ' ' + u.email).toLowerCase().includes(q))

            if(rows.length === 0){
                $('usersBody').innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Nincs megjeleníthető felhasználó.</td></tr>'
                return
            }
            $('usersBody').innerHTML = rows.map(u => {
                const active = u.status == 1
                const protectedUser = u.ID == admin.ID || u.role === 'admin' // magát és más admint nem lehet tiltani
                const action = protectedUser
                    ? '<span class="text-muted">–</span>'
                    : '<button type="button" class="btn btn-sm ' + (active ? 'btn-outline-danger' : 'btn-outline-dark') + '" data-ban="' + u.ID + '">' +
                      (active ? 'Tiltás' : 'Feloldás') + '</button>'
                return '<tr>' +
                    '<td class="fw-semibold">' + Utils.esc(u.name) + '</td>' +
                    '<td>' + Utils.esc(u.email) + '</td>' +
                    '<td>' + (u.role === 'admin' ? '<span class="badge text-bg-dark">Admin</span>' : '<span class="badge text-bg-dark">Felhasználó</span>') + '</td>' +
                    '<td>' + (active ? '<span class="badge text-bg-success">Aktív</span>' : '<span class="badge text-bg-danger">Letiltva</span>') + '</td>' +
                    '<td class="text-nowrap">' + Utils.date(u.reg) + '</td>' +
                    '<td class="text-nowrap">' + Utils.date(u.last, 'YYYY. MM. DD. HH:mm') + '</td>' +
                    '<td class="text-end">' + u.loginCount + '</td>' +
                    '<td class="text-end">' + action + '</td></tr>'
            }).join('')
        }

        $('usersBody').addEventListener('click', e => {
            const btn = e.target.closest('[data-ban]')
            if(!btn) return
            target = this.users.find(u => u.ID == btn.dataset.ban)
            const active = target.status == 1

            $('banTitle').textContent = active ? 'Felhasználó letiltása' : 'Letiltás feloldása'
            $('banText').textContent = active
                ? target.name + ' nem tud majd bejelentkezni, amíg fel nem oldod a tiltást.'
                : target.name + ' újra be tud majd jelentkezni.'
            $('banConfirm').textContent = active ? 'Letiltás' : 'Feloldás'
            $('banConfirm').className = 'btn ' + (active ? 'btn-danger' : 'btn-primary')
            banModal.show()
        })

        $('banConfirm').addEventListener('click', async () => {
            const btn = $('banConfirm')
            Utils.busy(btn, true)
            const res = await api('POST', '/admin/status', {uid: target.ID, luid: admin.ID})
            Utils.busy(btn, false)
            banModal.hide()

            if(!res.ok){
                Message.error(Message.of(res))
                return
            }
            Message.success(Message.of(res))
            load()
        })

        $('usersSearch').addEventListener('input', render)
        load()
    }
}
