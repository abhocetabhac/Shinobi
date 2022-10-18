$(document).ready(function(e){
    var theEnclosure = $('#tab-fileBinView')
    var monitorsList = theEnclosure.find('.monitors_list')
    var dateSelector = theEnclosure.find('.date_selector')
    var fileBinDrawArea = $('#fileBin_draw_area')
    var fileBinPreviewArea = $('#fileBin_preview_area')
    var loadedFilesInMemory = {};
    function openFileBinView(monitorId,startDate,endDate){
        drawFileBinViewElements(monitorId,startDate,endDate)
    }
    function getSelectedTime(asUtc){
        var dateRange = dateSelector.data('daterangepicker')
        var startDate = dateRange.startDate.clone()
        var endDate = dateRange.endDate.clone()
        if(asUtc){
            startDate = startDate.utc()
            endDate = endDate.utc()
        }
        startDate = startDate.format('YYYY-MM-DDTHH:mm:ss')
        endDate = endDate.format('YYYY-MM-DDTHH:mm:ss')
        return {
            startDate: startDate,
            endDate: endDate
        }
    }

    dateSelector.daterangepicker({
        startDate: moment().utc().subtract(2, 'days'),
        endDate: moment().utc(),
        timePicker: true,
        locale: {
            format: 'YYYY/MM/DD hh:mm:ss A'
        }
    }, function(start, end, label) {
        drawFileBinViewElements()
    })
    monitorsList.change(function(){
        drawFileBinViewElements()
    })
    function loadFileData(video){
        delete(video.f)
        loadedFilesInMemory[`${video.mid}${video.name}`] = video
    }
    function drawFileBinViewElements(selectedMonitor,startDate,endDate){
        var dateRange = getSelectedTime(false)
        if(!startDate)startDate = dateRange.startDate
        if(!endDate)endDate = dateRange.endDate
        if(!selectedMonitor)selectedMonitor = monitorsList.val()
        var queryString = ['start=' + startDate,'end=' + endDate,'limit=0']
        var frameIconsHtml = ''
        var apiURL = getApiPrefix('fileBin') + '/' + selectedMonitor;
        var fileBinData = []
        loadedFilesInMemory = {}
        $.getJSON(apiURL + '?' + queryString.join('&'),function(data){
            $.each(data.files,function(n,file){
                loadFileData(file)
            })
            fileBinDrawArea.bootstrapTable('destroy')
            fileBinDrawArea.bootstrapTable({
                pagination: true,
                search: true,
                columns: [
                      {
                        field: 'monitorName',
                        title: lang['Monitor']
                      },
                      {
                        field: 'name',
                        title: lang['Filename']
                      },
                      {
                        field: 'time',
                        title: lang['Time Created']
                      },
                      {
                        field: 'size',
                        title: ''
                      },
                      {
                        field: 'buttons',
                        title: ''
                      }
                ],
                data: data.files.map((file) => {
                    var href = getApiPrefix('fileBin') + '/' + selectedMonitor + '/' + file.name
                    var isVideo = file.name.includes('.mp4') || file.name.includes('.webm')
                    return {
                        monitorName: `<b>${loadedMonitors[file.mid]?.name || file.mid}</b>`,
                        name: file.name,
                        time: `
                            <div><b>${lang.Created}</b> ${formattedTime(file.time, 'DD-MM-YYYY hh:mm:ss AA')}</div>
                            ${file.details.start ? `<div><b>${lang.Started}</b> ${formattedTime(file.details.start, 'DD-MM-YYYY hh:mm:ss AA')}</div>` : ''}
                            ${file.details.end ? `<div><b>${lang.Ended}</b> ${formattedTime(file.details.end, 'DD-MM-YYYY hh:mm:ss AA')}</div>` : ''}
                        `,
                        size: convertKbToHumanSize(file.size),
                        buttons: `
                            <div class="row-info" data-mid="${file.mid}" data-ke="${file.ke}" data-time="${file.time}" data-name="${file.name}">
                                <a class="btn btn-sm btn-primary" href="${href}" download title="${lang.Download}"><i class="fa fa-download"></i></a>
                                ${isVideo ? `<a class="btn btn-sm btn-primary preview-video" href="${href}" title="${lang.Play}"><i class="fa fa-play"></i></a>` : ``}
                                ${permissionCheck('video_delete',file.mid) ? `<a class="btn btn-sm btn-${file.archive === 1 ? `success status-archived` : `default`} archive-file" title="${lang.Archive}"><i class="fa fa-${file.archive === 1 ? `lock` : `unlock-alt`}"></i></a>` : ''}
                                ${permissionCheck('video_delete',file.mid) ? `<a class="btn btn-sm btn-danger delete-file" title="${lang.Delete}"><i class="fa fa-trash-o"></i></a>` : ''}
                            </div>
                        `,
                    }
                })
            })
        })
    }
    function drawPreviewVideo(href){
        fileBinPreviewArea.html(`<video class="video_video" style="width:100%" autoplay controls preload loop src="${href}"></video>`)
    }
    function archiveFile(video,unarchive){
        return archiveVideo(video,unarchive,true)
    }
    async function archiveFiles(videos){
        for (let i = 0; i < videos.length; i++) {
            var video = videos[i];
            await archiveFile(video,false)
        }
    }
    function unarchiveFile(video){
        return archiveFile(video,true)
    }
    async function unarchiveFiles(videos){
        for (let i = 0; i < videos.length; i++) {
            var video = videos[i];
            await unarchiveFile(video)
        }
    }
    function deleteFile(video,callback){
        return new Promise((resolve,reject) => {
            var videoEndpoint = getApiPrefix(`fileBin`) + '/' + video.mid + '/' + video.name
            $.getJSON(videoEndpoint + '/delete',function(data){
                notifyIfActionFailed(data)
                if(callback)callback(data)
                resolve(data)
            })
        })
    }
    async function deleteFiles(videos){
        for (let i = 0; i < videos.length; i++) {
            var video = videos[i];
            await deleteFile(video)
        }
    }
    $('body')
    .on('click','.open-fileBin-video',function(e){
        e.preventDefault()
        var href = $(this).attr('href')
        openTab(`fileBinView`,{},null)
        drawPreviewVideo(href)
        return false;
    });
    theEnclosure
    .on('click','.refresh-data',function(e){
        e.preventDefault()
        drawFileBinViewElements()
        return false;
    })
    .on('click','.preview-video',function(e){
        e.preventDefault()
        var href = $(this).attr('href')
        drawPreviewVideo(href)
        return false;
    })
    .on('click','.archive-file',function(e){
        e.preventDefault()
        var el = $(this).parents('[data-mid]')
        var monitorId = el.attr('data-mid')
        var filename = el.attr('data-name')
        var unarchive = $(this).hasClass('status-archived')
        var file = loadedFilesInMemory[`${monitorId}${filename}`]
        if(!file)return console.log(`No File`,monitorId,filename,unarchive,file);
        if(unarchive){
            unarchiveFile(file)
        }else{
            archiveFile(file)
        }
        return false;
    })
    .on('click','.delete-file',function(e){
        e.preventDefault()
        var el = $(this).parents('[data-mid]')
        var monitorId = el.attr('data-mid')
        var filename = el.attr('data-name')
        var file = loadedFilesInMemory[`${monitorId}${filename}`]
        if(!file)return console.log(`No File`,monitorId,filename,unarchive,file);
        $.confirm.create({
            title: lang["Delete"] + ' : ' + file.name,
            body: `${lang.DeleteThisMsg}`,
            clickOptions: {
                title: '<i class="fa fa-trash-o"></i> ' + lang.Delete,
                class: 'btn-danger btn-sm'
            },
            clickCallback: function(){
                deleteFile(file).then(function(data){
                    if(data.ok){
                        drawFileBinViewElements()
                    }
                })
            }
        });
        return false;
    })
    addOnTabOpen('fileBinView', function () {
        drawMonitorListToSelector(monitorsList,null,null,true)
        drawFileBinViewElements()
    })
    addOnTabReopen('fileBinView', function () {
        var theSelected = `${monitorsList.val()}`
        drawMonitorListToSelector(monitorsList,null,null,true)
        monitorsList.val(theSelected)
    })
    addOnTabAway('fileBinView', function () {
        fileBinPreviewArea.find('video')[0].pause()
    })
})
