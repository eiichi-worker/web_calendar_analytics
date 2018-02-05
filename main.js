;(function () {
  var user = null
  var token = null

  $.getJSON('firebase.json' , function (data) {
    console.log('firebase.initialize')
    // console.log(data)
    firebase.initializeApp(data)
  })

  $('#signInButton').click(signIn)
  $('#signOutButton').click(signOut)
  $('#getCalendarEventButton').click(getCalendarEvent)
  $('#aggregateCategory1Button').click(aggregateCategory1)
  $('#aggregateDaily1Button').click(aggregateDaily1)

  var dataTable = $('#eventList').DataTable({
    dom: 'Bfrtip',
    buttons: [
      'copy', 'csv', 'excel', 'pdf', 'print'
    ],
    columns: [
      { title: '開始日時' },
      { title: '終了日時' },
      { title: 'タスク名' },
      { title: 'カテゴリ1' },
      { title: 'カテゴリ2' },
      { title: 'カテゴリ3' },
      { title: '作業時間' }
    ]
  })
  var calendarEventList = []

  var dataTableResultCategory = $('#resultCategory1').DataTable({
    dom: 'Bfrtip',
    buttons: [
      'copy', 'csv', 'excel', 'pdf', 'print'
    ],
    columns: [
      { title: 'カテゴリ1' },
      { title: '作業時間' }
    ]
  })
  var resultCategory1List = []

  var dataTableResultDaily
  var resultDaily1List = []

  // デフォルト値のセット
  var dt = new Date()
  console.log(dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-01')
  $('#targetDateRangeStart').val(dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-01')
  dt.setMonth(dt.getMonth() + 1)
  $('#targetDateRangeEnd').val(dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-01')

  function signIn () {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(function () {
        var provider = new firebase.auth.GoogleAuthProvider()
        // provider.addScope('https://www.googleapis.com/auth/contacts.readonly')
        provider.addScope('https://www.googleapis.com/auth/calendar.readonly')

        return firebase.auth().signInWithPopup(provider)
      })
      .then(function (result) {
        // This gives you a Google Access Token. You can use it to access the Google API.
        token = result.credential.accessToken
        // The signed-in user info.
        user = result.user

        console.log('Login成功')
        console.log(result)
        console.log(token)
        console.log(user)

        $('.loginName').text(user.displayName)
        $('.loginMail').text(user.email)

        // Calendar一覧取得
        getCalendarList(token)
      })
      .catch(function (error) {
        console.log('認証エラー')
        console.log(error.code)
        console.log(error.message)
      }
    )
  }

  function signOut () {
    firebase.auth().signOut().then(function () {
      console.log('signOut 成功')
    }).catch(function (error) {
      console.log('signOut エラー')
      console.log(error)
    })
  }

  function getCalendarList (token) {
    var authHeader = 'Bearer ' + token
    $.ajax({
      url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList/',
      type: 'GET',
      dataType: 'json',
      headers: {
        'Authorization': authHeader
      }
    })
      .done(function (data) {
        // $('.result').html(data)
        console.log('カレンダー一覧取得 成功')
        console.log(data)
        console.log(data.items)

        // セレクトボックスにカレンダー一覧をセット
        viewCalendarList(data.items)
      })
      .fail(function (data) {
        console.log('カレンダー一覧取得 エラー')
        console.log(data)
      })
  }

  function viewCalendarList (calendarList) {
    $('#targetCalendarSelector option').remove()

    calendarList.forEach(element => {
      $option = $('<option>')
        .val(element.id)
        .text(element.summary + '(' + element.id + ')')
      $('#targetCalendarSelector').append($option)
    })
  }

  function getCalendarEvent () {
    // 初期化
    calendarEventList = []
    dataTable.clear().draw()

    // 取得対象
    var calendarId = $('#targetCalendarSelector').val()
    var startDatetime = $('#targetDateRangeStart').val()
    var endDatetime = $('#targetDateRangeEnd').val()
    var getNum = $('#eventGetNum').val()

    var authHeader = 'Bearer ' + token
    $.ajax({
      url: 'https://www.googleapis.com/calendar/v3/calendars/' + calendarId + '/events/',
      type: 'GET',
      dataType: 'json',
      headers: {
        'Authorization': authHeader
      },
      data: {
        'timeMin': startDatetime + 'T00:00:00+09:00',
        'timeMax': endDatetime + 'T00:00:00+09:00',
        'maxResults': getNum,
      // 'timeZone': 'Asia/Tokyo',
      }
    })
      .done(function (data) {
        // $('.result').html(data)
        console.log('カレンダーevent取得 成功')
        console.log(data)
        console.log(data.items)

        var categoryList = eventListParser(data.items)

        // Event表示&格納
        data.items.forEach(element => {
          var startDatetime = moment(element.start.dateTime)
          var endDatetime = moment(element.end.dateTime)
          var workingTimeHour = endDatetime.diff(startDatetime, 'hours', true)
          console.log(workingTimeHour)

          var tmpRow = [
            element.start.dateTime,
            element.end.dateTime,
            element.summary,
            categoryList[element.id][0],
            categoryList[element.id][1],
            categoryList[element.id][2],
            workingTimeHour
          ]

          dataTable.row.add(tmpRow).draw()
          calendarEventList.push(tmpRow)
        })
        console.log('calendarEventList作成完了')
        console.log(calendarEventList)
      })
      .fail(function (data) {
        console.log('カレンダーevent取得 失敗')
        console.log(data)
      })
  }

  function eventListParser (list) {
    var categoryList = []
    var categoryReg = /(?:\[([^\]]+?)])/g
    list.forEach(element => {
      // var matchData=element.summary.match(categoryReg)
      var tmpList = []
      console.log(element.summary)
      while (matchData = categoryReg.exec(element.summary)) {
        console.log(matchData)
        tmpList.push(matchData[1])
      }

      // 3つ未満の場合空文字で埋める
      if (tmpList.length < 3) {
        // 長さが短い場合は空文字で埋める
        for (let i = tmpList.length; i < 3; i++) {
          tmpList[i] = ''
        }
      }
      console.log('配列の長さ整え')
      console.log(tmpList)

      categoryList[element.id] = tmpList
    })

    return categoryList
  }

  function aggregateCategory1 () {
    console.log('集計開始')
    // 初期化
    resultCategory1List = []
    dataTableResultCategory.clear().draw()

    var result = {}
    calendarEventList.forEach(function (event) {
      console.log(event)
      var categoryName = event[3]
      var workTime = event[6]

      console.log(categoryName)
      console.log(result[categoryName])
      console.log(typeof result[categoryName])

      if (typeof result[categoryName] !== 'number') {
        result[categoryName] = 0
      }
      result[categoryName] += workTime
    })

    console.log('集計結果')
    console.log(calendarEventList)
    console.log(result)

    for (key in result) {
      var tmpRow = [
        key,
        result[key]
      ]

      dataTableResultCategory.row.add(tmpRow).draw()
      resultCategory1List.push(tmpRow)
    }

    console.log('集計完了')
    console.log(resultCategory1List)
  }

  /**
   * 日別の集計
   * 列 日
   * 行 タスク
   * 
   */
  function aggregateDaily1 () {
    console.log('集計開始')
    // 初期化
    resultDaily1List = []
    // dataTableResultDaily.clear().draw()

    // 列設定
    var startDatetime = $('#targetDateRangeStart').val()
    var endDatetime = $('#targetDateRangeEnd').val()
    var columns = [
      { title: 'カテゴリ1', data: 'cat1'},
      { title: 'カテゴリ2', data: 'cat2'},
      { title: 'カテゴリ3', data: 'cat3'},
      { title: '合計時間', data: 'totalWorkingTime'}
    ]

    var pointDate = moment(startDatetime)
    var endDate = moment(endDatetime)
    while (pointDate.isBefore(endDate)) {
      var date = pointDate.format('YYYY-MM-DD')
      console.log('列追加: ' + date)
      columns.push({title: date,data: date})
      pointDate.add(1, 'days')
    }

    dataTableResultDaily = $('#resultDaily1').DataTable({
      dom: 'Bfrtip',
      buttons: [
        'copy', 'csv', 'excel', 'pdf', 'print'
      ],
      columns: columns
    })
    dataTableResultDaily.clear().draw()

    // 集計処理
    var result = {}
    calendarEventList.forEach(function (event) {
      console.log(event)
      var eventDate = moment(event[0]).format('YYYY-MM-DD')
      var categoryName1 = event[3]
      var categoryName2 = event[4]
      var categoryName3 = event[5]
      var workTime = event[6]

      var key = categoryName1 + '_' + categoryName2 + '_' + categoryName3 + '_' + eventDate
      if (typeof result[key] === 'undefined') {
        result[key] = {
          'cat1': categoryName1,
          'cat2': categoryName2,
          'cat3': categoryName3,
          'date': eventDate,
          'workingTime': 0
        }
      }
      result[key].workingTime += workTime
    })

    console.log('集計結果')
    console.log(calendarEventList)
    console.log(result)

    // 集計結果をまとめる
    for (key in result) {
      var tmpRow = {
        'cat1': result[key].cat1,
        'cat2': result[key].cat2,
        'cat3': result[key].cat3,
        'totalWorkingTime': 0
      }
      tmpRow[result[key].date] = result[key].workingTime

      resultDaily1List.push(tmpRow)
    }

    // nullを変換してDataテーブルに追加
    resultDaily1List.forEach(function (tmpRow) {
      var tmpPointDate = moment(startDatetime)
      var tmpEndDate = moment(endDatetime)
      while (tmpPointDate.isBefore(tmpEndDate)) {
        var date = tmpPointDate.format('YYYY-MM-DD')
        if (typeof tmpRow[date] === 'undefined') {
          tmpRow[date] = ''
        } else {
          tmpRow.totalWorkingTime += tmpRow[date]
        }

        tmpPointDate.add(1, 'days')
      }

      dataTableResultDaily.row.add(tmpRow).draw()
    })

    console.log('集計完了')
    console.log(resultDaily1List)
  }
}())
