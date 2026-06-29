let albumsData = []; // Данные из JSON
let currentAlbumTracks = []; // Список треков альбома, который сейчас играет
let currentArtistName = ''; // Имя артиста
let currentTrackIndex = -1; // Индекс песни, которая играет в данный момент
let marqueeTimeout = null; // Хранилище для таймера бегущей строки
let currentMarqueeId = 0; // Счётчик сессий анимации
let savedScrollPosition = 0; // Переменная для сохранения позиции прокрутки главной страницы
let navigationHistory = []; // История навигации
let loadedImagesCache = new Set(); // Глобальный набор для хранения URL-адресов загруженных картинок
let repeatMode = 0; // Режим повтора
const initUrlParams = new URLSearchParams(window.location.search);
let currentPage = parseInt(initUrlParams.get('page'), 10) || 1; // Текущая активная страница релиза

if (typeof isFirstLoad === 'undefined') {
    window.isFirstLoad = true; 
}

// Словарь для перевода типов релизов на русский язык
const releaseTypesRu = {
    'album': 'Альбом',
    'compilation': 'Компиляция',
    'ep': 'EP',
    'single': 'Сингл',
    'maxi-single': 'Макси-сингл',
    'mixtape': 'Микстейп'
};

// Ссылки на HTML-элементы
const audioPlayer = document.getElementById('main-audio');
const nowPlayingText = document.getElementById('now-playing');
const contentArea = document.getElementById('content-area');
const pageTitle = document.getElementById('page-title');
const albumHeader = document.getElementById('album-header');
const backBtn = document.getElementById('back-btn');
const masterPlayBtn = document.getElementById('master-play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const progressBar = document.getElementById('progress-bar');
const currentTimeText = document.getElementById('current-time');
const totalTimeText = document.getElementById('total-time');
const volumeBar = document.getElementById('volume-bar');
const searchContainer = document.getElementById('search-container');
const searchInput = document.getElementById('search-input');
const shuffleAllBtn = document.getElementById('shuffle-all-btn');
const customProgressFill = document.getElementById('custom-progress-fill');
const volumeToggleBtn = document.getElementById('volume-toggle-btn');
const volumeSliderWrapper = document.getElementById('volume-slider-wrapper');
const mobileVolumePopup = document.getElementById('mobile-volume-popup');
const mobileTrack = document.getElementById('mobile-volume-track');
const mobileFill = document.getElementById('mobile-volume-fill');
const pcVolumeFill = document.getElementById('custom-volume-fill');
const repeatBtn = document.getElementById('repeat-btn');

// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// Исправленный авто-конвертер ссылок
function getDirectLink(url) {
    if (!url) return '';

    // 1. Обработка Google Drive
    if (url.includes('drive.google.com')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) return 'https://google.com' + match[1];
    }
    
    // 2. Обработка Яндекс.Диска
    if (url.includes('disk.yandex.ru') || url.includes('yadi.sk')) {
        return `https://yandex.net${encodeURIComponent(url)}`;
    }
    
    return url;
}

// Форматирование секунд в формат 0:00
function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// 3. ИНИЦИАЛИЗАЦИЯ И СЕТКА АЛЬБОМОВ
async function init() {
    try {
        const response = await fetch('./playlist.json');
        albumsData = await response.json();
        
        const urlParams = new URLSearchParams(window.location.search);
        const albumIdFromUrl = urlParams.get('release');
        const artistFromUrl = urlParams.get('artist');

        // 1. Если в ссылке есть артист — сразу открываем его карточку
        if (artistFromUrl) {
            openArtistProfile(decodeURIComponent(artistFromUrl));
        } 
        // 2. Если в ссылке есть альбом — открываем альбом
        else if (albumIdFromUrl && albumsData.some(a => a.id === albumIdFromUrl)) {
            openAlbum(albumIdFromUrl);
        } 
        // 3. Иначе показываем обычную главную
        else {
            showAlbumsGrid(); 
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

function updateBackButtonText() {
    if (!backBtn) return;
    
    // Если история пуста (например, при возврате от артиста), пишем "Назад к релизам"
    if (navigationHistory.length === 0) {
        backBtn.textContent = '← Назад к альбомам';
        return;
    }
    
    // Смотрим на самый последний элемент в массиве истории (но не удаляем его из стека!)
    const nextBackPage = navigationHistory[navigationHistory.length - 1];
    
    if (nextBackPage.screen === 'main') {
        // ИСПРАВЛЕНО: Когда пришли с главной, кнопка должна вести назад к РЕЛИЗАМ
        backBtn.textContent = '← Назад к альбомам'; 
    } 
    else if (nextBackPage.screen === 'release') {
        // ИСПРАВЛЕНО: Когда пришли из релиза, кнопка должна вести назад к РЕЛИЗУ (в единственном числе)
        backBtn.textContent = '← Назад к релизу'; 
    } 
    else if (nextBackPage.screen === 'artist') {
        backBtn.textContent = '← Назад к артисту';
    }
}

function showAlbumsGrid(isBackMode = false) {
    // Если мы вернулись кнопкой Назад, используем сохраненный скролл, иначе обнуляем
    const targetScroll = isBackMode ? savedScrollPosition : 0;
    
    // Считываем параметры из адресной строки браузера
    const renderUrlParams = new URLSearchParams(window.location.search);
    const hasPageParam = renderUrlParams.has('page');

    // Если это самый первый запуск сайта (F5 или переход по ссылке) и в URL есть страница
    if (window.isFirstLoad && hasPageParam) {
        currentPage = parseInt(renderUrlParams.get('page'), 10) || 1;
        window.isFirstLoad = false; // Первая загрузка успешно обработана, выключаем флаг
    }
    // Если это новый чистый заход на главную (клик по названию сайта для сброса, как в твоем коде)
    else if (!isBackMode) {
        currentPage = 1;
        window.isFirstLoad = false; // На всякий случай гасим флаг и тут
    } 
    // Если это возврат кнопкой Назад или переключение страниц пагинации
    else if (hasPageParam) {
        currentPage = parseInt(renderUrlParams.get('page'), 10) || 1;
    } 
    // Дефолтный сброс
    else {
        currentPage = 1;
    }

    setTimeout(() => { 
        window.scrollTo({ top: targetScroll, behavior: 'instant' }); 
    }, 0);

    if (!isBackMode) {
        navigationHistory = []; // Очищаем историю при выходе на главную с нуля
    }
    // Очищаем URL-параметры экранов релиза и артиста, но сохраняем текущую страницу пагинации
    const mainUrl = new URL(window.location.href);
    mainUrl.searchParams.delete('release');
    mainUrl.searchParams.delete('artist');
    
    // Если мы на первой странице, для красоты можно убрать ?page=1 из строки, иначе сохраняем его
    if (currentPage > 1) {
        mainUrl.searchParams.set('page', currentPage);
    } else {
        mainUrl.searchParams.delete('page');
    }
    window.history.pushState({}, '', mainUrl.pathname + mainUrl.search);
    
    backBtn.style.display = 'none';
    albumHeader.style.display = 'none';
    pageTitle.style.display = 'block';
    pageTitle.textContent = 'RARETENOR'; 
    
    // Включаем видимость поиска на главном экране
    searchContainer.style.setProperty('display', 'flex', 'important');
    
    contentArea.className = 'albums-grid'; 
    contentArea.innerHTML = '';
    
    // Получаем текущее значение из поля поиска (переводим в нижний регистр для точности)
    const query = searchInput.value.toLowerCase().trim();

    // Фильтруем массив релизов
    const filteredAlbums = albumsData.filter(album => {
        const titleMatch = album.title.toLowerCase().includes(query);
        const artistMatch = album.artist.toLowerCase().includes(query);
        return titleMatch || artistMatch;
    });

    // Если ничего не найдено, выводим аккуратную плашку
    if (filteredAlbums.length === 0) {
        contentArea.className = ''; // Сбрасываем сетку для центрирования текста
        contentArea.innerHTML = '<p style="color: #727272; text-align: center; margin-top: 40px;">Ничего не найдено</p>';
        return;
    }

    // ПАГИНАЦИЯ: 1. Получаем лимит карточек для текущего устройства (12 или 16)
    const itemsPerPage = getItemsPerPageLimit();

    // ПАГИНАЦИЯ: 2. Высчитываем индексы среза отфильтрованного массива
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    // ПАГИНАЦИЯ: 3. Режем отфильтрованные альбомы строго под текущую страницу
    const paginatedAlbums = filteredAlbums.slice(startIndex, endIndex);

    // Отрисовываем только отфильтрованные релизы (теперь берем из пагинированного куска)
    paginatedAlbums.forEach(album => {
        // Логика обработки тегов релиза
        let tagHtml = '';
        if (album.tag) {
            if (album.tag.toLowerCase() === 'explicit') {
                tagHtml = '<span class="tag-explicit">E</span>';
            } else {
                tagHtml = `<span class="tag-custom">${album.tag.toUpperCase()}</span>`;
            }
        }

        const albumCard = document.createElement('div');
        albumCard.className = 'album-card';
        albumCard.onclick = () => openAlbum(album.id);
        
        const imageName = album.cover.split('/').pop();
        const isMainCached = loadedImagesCache.has(imageName);
        const mainLoadedClass = isMainCached ? 'is-loaded' : '';

        albumCard.innerHTML = `
            <div class="album-card-img-wrapper">
                <img src="${album.cover}" alt="${album.title}" class="${mainLoadedClass}" loading="lazy" decoding="async" onload="onImageLoad(this)">
            </div>
            <span class="grid-badge badge-${album.type}">${releaseTypesRu[album.type] || album.type}</span>
            <h3>${album.title} ${tagHtml}</h3>
            <p>${album.artist}</p>
            <p>${extractYearOnly(album.year)}</p>
        `;
        contentArea.appendChild(albumCard);
    });

    // ПАГИНАЦИЯ: Отрисовываем кнопки страниц под сеткой карточек (передаем длину отфильтрованного списка)
    renderPaginationControls(filteredAlbums.length, itemsPerPage);
}

function renderPaginationControls(totalItems, itemsPerPage) {
    const oldControls = document.getElementById('pagination-controls');
    if (oldControls) oldControls.remove();

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return; 

    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'pagination-controls';
    controlsContainer.className = 'pagination-container';

    // Вспомогательная функция для обновления параметра page в URL без перезагрузки
    const updatePageUrl = (pageNumber) => {
        const url = new URL(window.location.href);
        url.searchParams.set('page', pageNumber);
        window.history.pushState({}, '', url.toString());
    };

    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.textContent = '←';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
        currentPage--;
        updatePageUrl(currentPage); // Обновляем URL
        showAlbumsGrid(true); 
        window.scrollTo({ top: 0, behavior: 'instant' }); 
    });
    controlsContainer.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = 'page-btn';
        if (i === currentPage) pageBtn.classList.add('active-page');
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            updatePageUrl(currentPage); // Обновляем URL
            showAlbumsGrid(true);
            window.scrollTo({ top: 0, behavior: 'instant' });
        });
        controlsContainer.appendChild(pageBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.textContent = '→';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
        currentPage++;
        updatePageUrl(currentPage); // Обновляем URL
        showAlbumsGrid(true);
        window.scrollTo({ top: 0, behavior: 'instant' });
    });
    controlsContainer.appendChild(nextBtn);

    contentArea.appendChild(controlsContainer);
}

// 4. ЭКРАН ТРЕКОВ АЛЬБОМА
function openAlbum(albumId, isBackMode = false) {
    const currentScroll = window.scrollY || document.documentElement.scrollTop;
    
    // Если это новый переход, а не возврат кнопкой Назад
    if (!isBackMode) {
        // 1. Проверяем, какой экран сейчас физически активен перед переключением
        const isArtistView = contentArea.classList.contains('artist-profile-view');
        
        if (isArtistView) {
            // Если мы пришли с карточки артиста, находим имя этого артиста на экране
            const artistNameElement = document.querySelector('.artist-profile-name');
            const artistName = artistNameElement ? artistNameElement.textContent.trim() : null;
            if (artistName) {
                navigationHistory.push({ screen: 'artist', id: artistName, scroll: currentScroll });
            }
        } else {
            // Иначе считаем, что мы пришли с главного экрана (или поиска)
            navigationHistory.push({ screen: 'main', id: null, scroll: currentScroll, page: currentPage });
        }
    }

    // Твой оригинальный скролл наверх без анимации
    window.scrollTo({ top: 0, behavior: 'instant' });
    
    const album = albumsData.find(a => a.id === albumId);
    if (!album) return;

    // УМНЫЙ ПЕРЕХВАТЧИК: Если это пустой альбом со ссылкой на VK
if (album.url && album.url.includes('://vk.com') && (!album.tracks || album.tracks.length === 0)) {
    // Включаем визуальный индикатор загрузки вместо списка треков
    contentArea.innerHTML = `
        <div style="text-align: center; color: #1db954; padding: 40px; font-weight: bold;">
            ⏳ Импортируем плейлист из ВКонтакте...
        </div>
    `;
    
    // Запускаем функцию разбора ссылки (напишем её в Шаге 3)
    parseVkPlaylistUrl(album);
    return; // Временно выходим из openAlbum, пока треки загружаются
}
    
    
    // Дописываем ?release=ID_АЛЬБОМА в адресную строку браузера
    const newUrl = `${window.location.pathname}?release=${albumId}`;
    window.history.pushState({ albumId: albumId }, '', newUrl);
    
    //pageTitle.style.display = 'none';
    searchContainer.style.setProperty('display', 'none', 'important');
    backBtn.style.display = 'block';
    albumHeader.style.display = 'flex';
    
    updateBackButtonText();
    
    albumHeader.innerHTML = '';
    
    // Логика обработки тегов релиза для шапки (explicit или кастомные)
    let tagHtml = '';
    if (album.tag) {
        if (album.tag.toLowerCase() === 'explicit') {
            tagHtml = '<span class="tag-explicit header-tag">E</span>';
        } else {
            tagHtml = `<span class="tag-custom header-tag">${album.tag.toUpperCase()}</span>`;
        }
    }
    
    const largeImageName = album.cover.split('/').pop();
    const isLargeCoverCached = loadedImagesCache.has(largeImageName);
    const largeLoadedClass = isLargeCoverCached ? 'is-loaded' : '';

    albumHeader.innerHTML = `
        <div class="album-large-cover-wrapper">
            <!-- Класс largeLoadedClass сразу сделает картинку четкой, если она в кэше -->
            <img src="${album.cover}" alt="${album.title}" class="album-large-cover ${largeLoadedClass}" loading="lazy" decoding="async" onload="onImageLoad(this)">
        </div>
        <div class="album-info-text">
            <span class="badge badge-${album.type}">${releaseTypesRu[album.type] || album.type}</span>
            <h2 class="album-title-header">${album.title} ${tagHtml}</h2>
            <p class="meta">
                <span class="artist-link" onclick="openArtistProfile('${album.artist.replace(/'/g, "\\'")}')">${album.artist}</span> 
                • ${extractYearOnly(album.year)} • ${album.genre}
            </p>
        </div>
    `;

    contentArea.className = 'tracks-list';
    contentArea.innerHTML = '';
    
   //Наполняем внутренний HTML строки
   album.tracks.forEach((track, index) => {
        const trackRow = document.createElement('div');
        trackRow.className = 'track-item';
        
        // Привязываем ID трека к строчке HTML
        trackRow.setAttribute('data-track-id', track.id);
        trackRow.innerHTML = `
            <span class="track-number">${index + 1}</span>
            <div class="track-info">
                <h3>${track.title}</h3>
                <p>${album.artist}</p>
            </div>
            <span class="track-duration">${track.duration}</span>
        `;
        
        // 2. Создаем кнопку отдельно
        const playButton = document.createElement('button');
        playButton.className = 'play-btn-gray';
        // Сохраняем индекс в дата-атрибут для глобального клика
        playButton.setAttribute('data-index', index); 
        
        // Корректный значок при отрисовке списка
        if (currentAlbumTracks === album.tracks && currentTrackIndex === index && !audioPlayer.paused) {
            playButton.textContent = '❙❙';
        } else {
            playButton.textContent = '▶';
        }
  
        // 2. Сначала вставляем кнопку в самое начало, а затем добавляем всю строку на экран
        trackRow.insertBefore(playButton, trackRow.firstChild);
        contentArea.appendChild(trackRow);
    });
    
    if (currentTrackIndex !== -1 && currentAlbumTracks === album.tracks) {
        const playingTrack = currentAlbumTracks[currentTrackIndex];
        if (playingTrack) {
            const activeRow = document.querySelector(`[data-track-id="${playingTrack.id}"]`);
            if (activeRow) activeRow.classList.add('is-playing');
        }
    }
}

// 5. ЛОГИКА ПЛЕЕРА И БЕГУЩЕЙ СТРОКИ
function playTrack(track, index, tracksList, artistName) {
    currentAlbumTracks = tracksList;
    currentArtistName = artistName;
    currentTrackIndex = index;

    const directUrl = getDirectLink(track.url);
    
    // Если это ссылка на VK (содержит .m3u8) и браузер поддерживает Hls.js
    if (directUrl.includes('.m3u8') && Hls.isSupported()) {
        // Если прошлый поток HLS уже был запущен, уничтожаем его экземпляр
        if (window.currentHlsInstance) {
            window.currentHlsInstance.destroy();
        }
        
        const hls = new Hls();
        hls.loadSource(directUrl);
        hls.attachMedia(audioPlayer);
        window.currentHlsInstance = hls; // сохраняем ссылку в глобальный объект
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            audioPlayer.play().catch(e => console.log("Ошибка старта HLS:", e));
        });
    
    } else {
        // Для обычных mp3 и облаков оставляем твой стандартный код
        if (window.currentHlsInstance) {
            window.currentHlsInstance.destroy();
            window.currentHlsInstance = null;
        } 
        audioPlayer.src = directUrl;
        audioPlayer.play().catch(e => console.log("Ошибка старта MP3:", e));
    }
    
    masterPlayBtn.textContent = '❙❙'; 
    nowPlayingText.textContent = `${artistName} - ${track.title}`;

    const container = document.querySelector('.now-playing-container');
    
    // СБРОС: Увеличиваем ID сессии. Прошлый трек поймет, что нужно остановиться
    currentMarqueeId++;
    const myId = currentMarqueeId; // Запоминаем ID текущего трека

    clearTimeout(marqueeTimeout);
    nowPlayingText.removeAttribute('style');
    nowPlayingText.classList.remove('is-long');

    // Проверяем, нужно ли запускать прокрутку
    if (nowPlayingText.scrollWidth > container.offsetWidth) {
        
        // Ждем 2 секунды, пока текст стоит по центру (благодаря margin: 0 auto)
        marqueeTimeout = setTimeout(() => {
            // ПРОВЕРКА: если за эти 2 секунды включили другой трек — выходим
            if (myId !== currentMarqueeId) return;
            
            // Текст длинный: отключаем авто-центрирование, прижимая строку к левому краю
            nowPlayingText.classList.add('is-long');
            
            const scrollDistance = nowPlayingText.scrollWidth - container.offsetWidth;
            const speed = 30; 
            const duration = scrollDistance * speed; 

            function startMarqueeLoop() {
                // ПРОВЕРКА: перед каждым новым кругом проверяем актуальность трека
                if (myId !== currentMarqueeId) return;

                // 1. Возвращаем в начальную левую точку без анимации
                nowPlayingText.style.transition = 'none';
                nowPlayingText.style.transform = 'translateX(0)';
                
                setTimeout(() => {
                    if (myId !== currentMarqueeId) return;
                    // 2. Плавно катим текст влево до самого конца строки
                    nowPlayingText.style.transition = `transform ${duration}ms linear`;
                    nowPlayingText.style.transform = `translateX(-${scrollDistance}px)`;
                }, 50);

                // 3. Ждем окончания поездки, замираем на 2 секунды и повторяем
                marqueeTimeout = setTimeout(() => {
                    if (myId !== currentMarqueeId) return;
                    startMarqueeLoop();
                }, duration + 2000);
            }

            // Запускаем цикл прокрутки
            startMarqueeLoop();

        }, 2000);
    }
    // ЛОГИКА ПОДСВЕТКИ ТРЕКА
    // 1. Сначала убираем зелёный цвет у абсолютно всех треков на экране
    document.querySelectorAll('.track-item').forEach(row => {
        row.classList.remove('is-playing');
    });

    // 2. Ищем строчку именно того трека, который мы только что запустили
    const activeRow = document.querySelector(`[data-track-id="${track.id}"]`);
    
    // 3. Если эта строчка сейчас отображается на экране — красим её в зелёный
    if (activeRow) {
        activeRow.classList.add('is-playing');
    }
    updateTrackListIcons();
}

function playNextTrack() {
    if (currentAlbumTracks.length === 0 || currentTrackIndex === -1) return;

    // РЕЖИМ 1: Повтор текущего трека (если включен, просто перематываем в ноль и играем заново)
    if (typeof repeatMode !== 'undefined' && repeatMode === 1) {
        audioPlayer.currentTime = 0;
        audioPlayer.play();
        return; // Выходим из функции, не переключая индекс вперед
    }

    const nextIndex = currentTrackIndex + 1;
    
    if (nextIndex < currentAlbumTracks.length) {
        const nextTrack = currentAlbumTracks[nextIndex];
        
        // Если у трека есть сохраненный автор (из перемешанного списка), берем его. 
        // Если нет — ищем стандартным способом через альбомы.
        const artistName = nextTrack.albumArtist || 
                           albumsData.find(a => a.tracks.includes(nextTrack))?.artist || 
                           "Исполнитель";
                           
        playTrack(nextTrack, nextIndex, currentAlbumTracks, artistName);
    } else if (typeof repeatMode !== 'undefined' && repeatMode === 2) {
        // РЕЖИМ 2: Повтор альбома (если доиграл последний трек — прыгаем на самый первый с индексом 0)
        const firstTrack = currentAlbumTracks[0];
        
        // Точно так же безопасно ищем автора для первого трека
        const artistName = firstTrack.albumArtist || 
                           albumsData.find(a => a.tracks.includes(firstTrack))?.artist || 
                           "Исполнитель";
                           
        playTrack(firstTrack, 0, currentAlbumTracks, artistName);
    } else {
        // Альбом полностью завершился сам:
        // Меняем иконку на панели на "Плей" (▶)
        masterPlayBtn.textContent = '▶';
        
        // Просто оставляем текущий индекс равным длине массива (сигнал, что мы в конце)
        currentTrackIndex = currentAlbumTracks.length; 
    }
}

function playPrevTrack() {
    // Если список треков пуст или мы не знаем текущий индекс, выходим
    if (!currentAlbumTracks || currentAlbumTracks.length === 0 || currentTrackIndex === -1) return;

    // Высчитываем индекс предыдущей песни
    const prevIndex = currentTrackIndex - 1;
    
    // Если предыдущий трек существует в альбоме (мы не на первой песне)
    if (prevIndex >= 0) {
        const prevTrack = currentAlbumTracks[prevIndex];
        
        // Твоя фирменная логика поиска автора (полностью сохранена)
        const artistName = prevTrack.albumArtist || 
                           (typeof albumsData !== 'undefined' && albumsData.find(a => a.tracks.includes(prevTrack))?.artist) || 
                           "Исполнитель";
                           
        playTrack(prevTrack, prevIndex, currentAlbumTracks, artistName);
        
        // ФИКС: Обязательно обновляем иконки в списке треков на экране альбома!
        updateTrackListIcons(); 
    } else {
        // Если мы нажали "Назад" на самом первом треке — просто перематываем его в начало
        audioPlayer.currentTime = 0;
        audioPlayer.play().catch(e => console.log(e));
        
        // На всякий случай обновляем иконки и тут
        updateTrackListIcons(); 
    }
}

// 6. СОБЫТИЯ И ИНТЕРФЕЙС УПРАВЛЕНИЯ
if (masterPlayBtn) {
    masterPlayBtn.addEventListener('click', () => {
        if (currentAlbumTracks.length === 0 || currentTrackIndex === -1) return; 
        
        if (currentTrackIndex === currentAlbumTracks.length) {
            const firstTrack = currentAlbumTracks[0];
            const artistName = albumsData.find(a => a.tracks.includes(firstTrack))?.artist || "Исполнитель";
            playTrack(firstTrack, 0, currentAlbumTracks, artistName);
            return; 
        }
        
        if (audioPlayer.paused) {
            audioPlayer.play();
        } else {
            audioPlayer.pause();
        }
        updateTrackListIcons();
    });
}

if (nextBtn) {
    nextBtn.addEventListener('click', () => {
        if (currentAlbumTracks.length > 0 && currentTrackIndex !== -1) {
            const nextIndex = currentTrackIndex + 1;
            if (nextIndex < currentAlbumTracks.length) {
                const nextTrack = currentAlbumTracks[nextIndex];
                const artistName = nextTrack.albumArtist || albumsData.find(a => a.tracks.includes(nextTrack))?.artist || "Исполнитель";
                playTrack(nextTrack, nextIndex, currentAlbumTracks, artistName);
                updateTrackListIcons(); 
            }
        }
    });
}

if (prevBtn) {
    prevBtn.addEventListener('click', () => {
        playPrevTrack(); 
    });
}

// Автопереключение при окончании песни
if (audioPlayer) {
    audioPlayer.addEventListener('ended', () => {
        playNextTrack();
        updateTrackListIcons();
    });

    audioPlayer.addEventListener('timeupdate', () => {
        if (audioPlayer.duration && progressBar) {
            const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            progressBar.value = progress;
            if (currentTimeText) currentTimeText.textContent = formatTime(audioPlayer.currentTime);
            
            // Фикс закрашивания полосы прогресса в зеленый цвет
            const customProgressFill = document.getElementById('custom-progress-fill');
            if (customProgressFill) {
                customProgressFill.style.width = `${progress}%`;
            }
        }
    });

    audioPlayer.addEventListener('loadedmetadata', () => {
        if (totalTimeText) totalTimeText.textContent = formatTime(audioPlayer.duration);
        const customProgressFill = document.getElementById('custom-progress-fill');
        if (customProgressFill) customProgressFill.style.width = '0%';

        // СИНХРОНИЗАЦИЯ ШТОРКИ: Передаем данные, когда песня гарантированно определилась
        if ('mediaSession' in navigator && currentAlbumTracks && currentTrackIndex !== -1) {
            const currentTrack = currentAlbumTracks[currentTrackIndex];
            
            if (currentTrack) {
                // ИСПРАВЛЕНО: Твоя полная и безопасная строка поиска автора релиза
                const artistName = currentTrack.albumArtist || 
                                   (typeof albumsData !== 'undefined' && albumsData.find(a => a.tracks.includes(currentTrack))?.artist) || 
                                   "Исполнитель";

                navigator.mediaSession.metadata = new MediaMetadata({
                    title: currentTrack.title,
                    artist: artistName,
                    album: "Релиз"
                });

                // 1. Системная кнопка ВПЕРЕД — вызывает твою функцию напрямую
                navigator.mediaSession.setActionHandler('nexttrack', () => {
                    playNextTrack();
                });

                // 2. Системная кнопка НАЗАД — теперь вызывает твою новую функцию НАПРЯМУЮ!
                navigator.mediaSession.setActionHandler('prevtrack', () => {
                    playPrevTrack(); // Никаких .click() и поиска кнопок по ID, чистая логика!
                });
            }
        }
    });

    // Сообщаем шторке уведомлений, что трек ЗАИГРАЛ
    audioPlayer.addEventListener('play', () => {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "playing";
        }
    });

    // Сообщаем шторке уведомлений, что трек на ПАУЗЕ
    audioPlayer.addEventListener('pause', () => {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "paused";
        }
    });

    // Установка начального звука плеера
    if (volumeBar) {
        audioPlayer.volume = volumeBar.value / 100;
    }
}

if (progressBar) {
    progressBar.addEventListener('input', () => {
        if (audioPlayer && audioPlayer.duration) {
            const timeToSet = (progressBar.value / 100) * audioPlayer.duration;
            audioPlayer.currentTime = timeToSet;
        }
    });
}

if (volumeBar) {
    // Установка начального звука
    audioPlayer.volume = volumeBar.value / 100;

    volumeBar.addEventListener('input', () => {
        const volumeValue = volumeBar.value;
        audioPlayer.volume = volumeValue / 100;
        
        // 1. Ищем и красим горизонтальный шлейф на ПК
        const pcVolumeFill = document.getElementById('custom-volume-fill');
        if (pcVolumeFill) {
            pcVolumeFill.style.width = `${volumeValue}%`;
        }

        // 2. Ищем и красим вертикальный шлейф на мобильном (на всякий случай для синхронизации)
        const mobileVolumeFill = document.getElementById('mobile-volume-fill');
        if (mobileVolumeFill) {
            mobileVolumeFill.style.height = `${volumeValue}%`;
        }
    });
}

// Глобальные события старта и паузы для синхронизации иконок
if (audioPlayer) {
    audioPlayer.addEventListener('play', () => {
        if (masterPlayBtn) masterPlayBtn.textContent = '❙❙'; 
        updateTrackListIcons(); 
    });

    audioPlayer.addEventListener('pause', () => {
        if (masterPlayBtn) masterPlayBtn.textContent = '▶'; 
        updateTrackListIcons(); 
    });
}

if (backBtn) {
    backBtn.addEventListener('click', () => {
        // Если история пуста, жестко выходим на главную сетку
        if (navigationHistory.length === 0) {
            showAlbumsGrid(true); 
            return;
        }

        // Вытаскиваем из стека самый последний шаг пользователя
        const previousPage = navigationHistory.pop();

        if (previousPage.screen === 'main') {
            savedScrollPosition = previousPage.scroll;
            // Восстанавливаем сохраненный номер страницы из истории переходов
            currentPage = previousPage.page || 1; 
            // Принудительно возвращаем ?page= в URL-строку, чтобы функция showAlbumsGrid его увидела
            const backUrl = new URL(window.location.href);
            if (currentPage > 1) {
                backUrl.searchParams.set('page', currentPage);
            } else {
                backUrl.searchParams.delete('page');
            }
            window.history.replaceState({}, '', backUrl.toString());
            showAlbumsGrid(true); // Возврат на главную сетку
        }
        
        else if (previousPage.screen === 'release') {
            openAlbum(previousPage.id, true); // Возврат внутрь релиза
            setTimeout(() => {
                window.scrollTo({ top: previousPage.scroll, behavior: 'instant' });
            }, 40);
        } 
        else if (previousPage.screen === 'artist') {
            openArtistProfile(previousPage.id, true); // Возврат на карточку артиста
            setTimeout(() => {
                window.scrollTo({ top: previousPage.scroll, behavior: 'instant' });
            }, 40);
        }
        updateBackButtonText();
    });
}

if (pageTitle) {
    pageTitle.addEventListener('click', () => {
        // Очищаем поисковую строку, чтобы при возврате вывелись вообще все альбомы
        if (searchInput) searchInput.value = '';
        
        // Полностью сбрасываем историю переходов, так как мы вернулись в самое начало
        navigationHistory = []; 
        
        // Вызываем функцию отрисовки главной сетки
        // Передаем false, так как это не возврат по кнопке Назад, а сброс навигации
        showAlbumsGrid(false); 
    });
}


// Функция для синхронизации иконок ▶ / ❙❙ во всем списке на экране
function updateTrackListIcons() {
    // 1. Возвращаем всем кнопкам на экране дефолтный значок Плей
    document.querySelectorAll('.track-item .play-btn-gray').forEach(btn => {
        btn.textContent = '▶';
    });
    
    // 2. Если сейчас трек выбран и плеер играет — находим именно его кнопку и ставим Паузу
    if (currentTrackIndex !== -1 && currentAlbumTracks.length > 0 && !audioPlayer.paused) {
        // Защита от выхода за пределы массива при окончании альбома
        if (currentTrackIndex < currentAlbumTracks.length) {
            const playingTrack = currentAlbumTracks[currentTrackIndex];
            if (playingTrack) {
                const activeRow = document.querySelector(`[data-track-id="${playingTrack.id}"]`);
                if (activeRow) {
                    const activeBtn = activeRow.querySelector('.play-btn-gray');
                    if (activeBtn) activeBtn.textContent = '❙❙';
                }
            }
        }
    }
}

searchInput.addEventListener('input', () => {
    currentPage = 1; // Сбрасываем на 1 страницу результатов при вводе текста
    savedScrollPosition = 0; // Сброс скролла для фикса бага с возвращением позиции при поиске
    // Обновляем URL, стирая старую страницу, чтобы функция не запуталась при чтении параметров
    const url = new URL(window.location.href);
    url.searchParams.delete('page');
    window.history.pushState({}, '', url.toString());
    
    showAlbumsGrid(true); // Передаем true, чтобы функция прочитала пустой/обновленный URL
});

// Функция генерации случайного плейлиста из всех релизов
function shuffleAllTracks() {
    let allTracks = [];

    // Собираем абсолютно все треки из каждого релиза базы данных
    albumsData.forEach(album => {
        album.tracks.forEach(track => {
            // Чтобы плеер не запутался в именах авторов компиляций, 
            // временно привяжем имя артиста релиза прямо к объекту трека
            allTracks.push({
                ...track,
                albumArtist: album.artist
            });
        });
    });

    if (allTracks.length === 0) return;

    // Алгоритм случайного перемешивания
    for (let i = allTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allTracks[i], allTracks[j]] = [allTracks[j], allTracks[i]];
    }

    // Формирование плейлиста для плеера; запуск самого первого (случайного) трека
    const firstRandomTrack = allTracks[0];
    
    // Передаем сформированный случайный массив в наш стандартный плеер
    playTrack(firstRandomTrack, 0, allTracks, firstRandomTrack.albumArtist);
}

// Навешиваем клик на кнопку Shuffle
shuffleAllBtn.addEventListener('click', shuffleAllTracks);

// "Прослушивание" системных кнопок "назад" и "вперед" в браузере
window.addEventListener('popstate', (event) => {
    const urlParams = new URLSearchParams(window.location.search);
    const albumId = urlParams.get('release');
    
    if (albumId) {
        openAlbum(albumId);
    } else {
        showAlbumsGrid();
    }
});

// 1. Показ/скрытие вертикальной капсулы по тапу на динамик
if (volumeToggleBtn && mobileVolumePopup) {
    volumeToggleBtn.addEventListener('click', (e) => {
        mobileVolumePopup.classList.toggle('is-open');
        e.stopPropagation();
    });

    // Клик в любое другое место экрана закрывает панель громкости
    document.addEventListener('click', (e) => {
        if (!mobileVolumePopup.contains(e.target) && e.target !== volumeToggleBtn) {
            mobileVolumePopup.classList.remove('is-open');
        }
    });
}

// 2. Функция расчета и установки громкости при таче на телефоне
function setMobileVolume(e) {
    if (!mobileTrack || !audioPlayer) return;
    
    const rect = mobileTrack.getBoundingClientRect();
    const touchY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;

    
    // Вычисляем позицию клика/тача по вертикали относительно серой линии
    let offsetY = touchY - rect.top;
    let percentage = ((rect.height - offsetY) / rect.height) * 100;
    
    // Ограничиваем рамками от 0 до 100%
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;
    
    // Применяем громкость к плееру
    audioPlayer.volume = percentage / 100;
    
    // Обновляем шлейф на мобилке
    if (mobileFill) mobileFill.style.height = `${percentage}%`;
    
    // Синхронизируем значение с ползунком ПК (на случай если окно растянут обратно)
    if (volumeBar) volumeBar.value = percentage;
    if (pcVolumeFill) pcVolumeFill.style.width = `${percentage}%`;
}

// 3. Вешаем мобильные touch-события на вертикальную капсулу
if (mobileVolumePopup) {
    // Переменная-флаг, которая проверяет, зажата ли левая кнопка мыши прямо сейчас
    let isMouseDownOnVolume = false;

    // ОБРАБОТКА ДЛЯ ТЕЛЕФОНОВ (ТАЧИ)
    mobileVolumePopup.addEventListener('touchstart', (e) => {
        setMobileVolume(e);
        e.preventDefault(); // Защита от системного скролла страницы при регулировке звука
    });
    
    mobileVolumePopup.addEventListener('touchmove', (e) => {
        setMobileVolume(e);
        e.preventDefault();
    });

    // ОБРАБОТКА ДЛЯ КОМПЬЮТЕРОВ (КЛИКИ И ПЕРЕТАСКИВАНИЕ МЫШКОЙ ПРИ УЗКОМ ОКНЕ)
    mobileVolumePopup.addEventListener('mousedown', (e) => {
        isMouseDownOnVolume = true;
        setMobileVolume(e); // Громкость меняется сразу при клике в любую точку капсулы
        e.preventDefault();
    });

    // Если мышка двигается с зажатой кнопкой — плавно меняем звук вслед за курсором
    document.addEventListener('mousemove', (e) => {
        if (isMouseDownOnVolume) {
            setMobileVolume(e);
        }
    });

    // Как только кнопку мыши отпустили в любой точке экрана — прекращаем регулировку
    document.addEventListener('mouseup', () => {
        isMouseDownOnVolume = false;
    });
}

// ФУНКЦИЯ ОТКРЫТИЯ КАРТОЧКИ АРТИСТА (С УМНОЙ НАВИГАЦИЕЙ И ВСЕМИ КАТЕГОРИЯМИ)
function openArtistProfile(artistName, isBackMode = false) {
    const currentScroll = window.scrollY || document.documentElement.scrollTop;

    if (!isBackMode) {
        const urlParams = new URLSearchParams(window.location.search);
        const currentAlbumId = urlParams.get('release');
        if (currentAlbumId) {
            navigationHistory.push({ screen: 'release', id: currentAlbumId, scroll: currentScroll });
        }
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
    
    const newUrl = `${window.location.pathname}?artist=${encodeURIComponent(artistName)}`;
    window.history.pushState({ artistName: artistName }, '', newUrl);
    
    // pageTitle.style.display = 'none';
    searchContainer.style.setProperty('display', 'none', 'important');
    backBtn.style.display = 'block';
    albumHeader.style.display = 'none'; 

    updateBackButtonText();
    
    const artistReleases = albumsData.filter(album => album.artist.toLowerCase() === artistName.toLowerCase());
    if (artistReleases.length === 0) return;

    // СОРТИРОВКА ПО ПОЛНОЙ ДАТЕ: От самого свежего релиза к самому старому
    artistReleases.sort((a, b) => {
        return parseReleaseDateToTimestamp(b.year) - parseReleaseDateToTimestamp(a.year);
    });
    
    // Обложка релиза берётся из первого (теперь хронологически точного) элемента
    let bannerImageUrl = artistReleases[0]?.cover || '';

    // СЛОВАРЬ СОПОСТАВЛЕНИЯ ИМЕН АРТИСТОВ С РЕАЛЬНЫМИ ПАПКАМИ
    const artistFolderMap = {
        "aquakey": "AQUAKEY (Russia)",
        "lildrughill": "LILDRUGHILL",
        "rocket": "ROCKET (Russia)",
        "superior.cat.proteus": "SCP (Russia)",
        "unotheactivist": "UnoTheActivist",
        "zavet": "Zavet (Russia)"
    };

    // СПИСОК АРТИСТОВ, У КОТОРЫХ СУЩЕСТВУЕТ КАСТОМНЫЙ БАННЕР НА ГИТХАБЕ
    const artistsWithCustomBanners = ["aquakey", "lildrughill", "rocket", "unotheactivist", "zavet"]; 

    const cleanArtistName = artistName.toLowerCase().trim();
    const exactFolderName = artistFolderMap[cleanArtistName] || artistName;
    
    // Проверяем по списку: если артист в нём есть — МГНОВЕННО подставляем путь к его баннеру
    if (artistsWithCustomBanners.includes(cleanArtistName)) {
        bannerImageUrl = `./Covers/${exactFolderName}/Banner.jpg`;
    }

    contentArea.className = 'artist-profile-view';
    contentArea.innerHTML = '';

    // Безопасная проверка наличия строки для кэша размытия
    const bannerFileName = bannerImageUrl ? bannerImageUrl.split('/').pop() : '';
    const isBannerCached = bannerFileName ? loadedImagesCache.has(bannerFileName) : false;
    const bannerLoadedClass = isBannerCached ? 'is-loaded' : '';

    const artistHeaderHtml = `
        <div class="artist-banner-zone">
            <img src="${bannerImageUrl}" style="display:none;" onload="this.parentElement.classList.add('is-loaded'); onImageLoad(this);">
            <div class="artist-banner-bg ${bannerLoadedClass}" style="background-image: linear-gradient(to bottom, rgba(18,18,18,0.3), #121212), url('${bannerImageUrl}');"></div>
            <h1 class="artist-profile-name">${artistName.toUpperCase()}</h1>
        </div>
    `;
    
    // Разделяем релизы на категории
    const fullAlbums = artistReleases.filter(r => r.type === 'album' || r.type === 'mixtape' || r.type === 'compilation');
    const singlesAndEps = artistReleases.filter(r => r.type === 'single' || r.type === 'ep' || r.type === 'maxi-single');

    let contentHtml = artistHeaderHtml;

    // Отрисовываем блок "Альбомы" (если они есть)
    if (fullAlbums.length > 0) {
        contentHtml += `<h2 class="artist-section-title">Альбомы, микстейпы и компиляции</h2>`;
        contentHtml += `<div class="albums-grid">`;
        fullAlbums.forEach(album => { contentHtml += generateMiniCardHtml(album); });
        contentHtml += `</div>`;
    }

    // Отрисовываем блок "Синглы и EP" (если они есть)
    if (singlesAndEps.length > 0) {
        contentHtml += `<h2 class="artist-section-title">Синглы, макси-синглы и EP</h2>`;
        contentHtml += `<div class="albums-grid">`;
        singlesAndEps.forEach(album => { contentHtml += generateMiniCardHtml(album); });
        contentHtml += `</div>`;
    }

    contentArea.innerHTML = contentHtml;
}

// Помощник для генерации кода карточки
function generateMiniCardHtml(album) {
    let tagHtml = '';
    if (album.tag && album.tag.toLowerCase() === 'explicit') {
        tagHtml = '<span class="tag-explicit">E</span>';
    } else if (album.tag) {
        tagHtml = `<span class="tag-custom">${album.tag.toUpperCase()}</span>`;
    }

    const imageName = album.cover.split('/').pop();
    const isCached = loadedImagesCache.has(imageName);
    const loadedClass = isCached ? 'is-loaded' : '';

    return `
        <div class="album-card" onclick="openAlbum('${album.id}')">
            <div class="album-card-img-wrapper">
                <img src="${album.cover}" alt="${album.title}" class="${loadedClass}" loading="lazy" decoding="async" onload="onImageLoad(this)">
            </div>
            <span class="grid-badge badge-${album.type}">${releaseTypesRu[album.type] || album.type}</span>
            <h3>${album.title} ${tagHtml}</h3>
            <p>${extractYearOnly(album.year)}</p>
        </div>
    `;
}

// Функция, которая вызывается в момент onload абсолютно любой обложки на сайте
function onImageLoad(imgElement) {
    if (!imgElement) return;
    
    imgElement.classList.add('is-loaded');
    
    if (imgElement.src) {
        // Вытаскиваем чистое имя файла перед сохранением в кэш
        const imageName = imgElement.src.split('/').pop();
        loadedImagesCache.add(imageName);
    }
}

// Умный конвертер дат для хронологической сортировки релизов
function parseReleaseDateToTimestamp(dateStr) {
    if (!dateStr) return 0;
    
    const cleanStr = String(dateStr).trim();
    
    // Проверяем формат ДД.ММ.ГГГГ (например, 15.04.2024)
    const datePattern = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
    const match = cleanStr.match(datePattern);
    
    if (match) {
        const day = parseInt(match[1], 10);
        // В JavaScript месяцы считаются с 0 (январь - 0, декабрь - 11)
        const month = parseInt(match[2], 10) - 1; 
        const year = parseInt(match[3], 10);
        
        return new Date(year, month, day).getTime();
    }
    
    // Если введена не полная дата, а просто 4 цифры года (например, 2024)
    const yearPattern = /^(\d{4})$/;
    const yearMatch = cleanStr.match(yearPattern);
    if (yearMatch) {
        const year = parseInt(yearMatch[1], 10);
        return new Date(year, 0, 1).getTime(); // Считаем как 1 января этого года
    }
    
    return 0; // На случай непредвиденного формата
}

// Функция-помощник: вытаскивает только 4 цифры года для красивого вывода на экран
function extractYearOnly(dateStr) {
    if (!dateStr) return '';
    const cleanStr = String(dateStr).trim();
    const match = cleanStr.match(/(\d{4})/); // Ищет любые стоящие подряд 4 цифры
    return match ? match[1] : cleanStr;
}

// Глобальное делегирование кликов для кнопок воспроизведения в альбоме
contentArea.addEventListener('click', (e) => {
    // Проверяем, кликнул ли пользователь на кнопку проигрывания или на символ внутри нее
    const playBtn = e.target.closest('.play-btn-gray');
    if (!playBtn) return; // Если клик мимо кнопки, игнорируем

    // Достаем индекс трека, который мы сохранили
    const index = parseInt(playBtn.getAttribute('data-index'), 10);
    
    // Определяем, какой альбом сейчас открыт, используя параметры адресной строки
    const urlParams = new URLSearchParams(window.location.search);
    const albumId = urlParams.get('release');
    
    if (!albumId || !albumsData) return;
    
    const album = albumsData.find(a => a.id === albumId);

    if (album && album.tracks && album.tracks[index]) {
        // Если кликнули по треку, который УЖЕ выбран
        if (currentAlbumTracks === album.tracks && currentTrackIndex === index) {
            if (audioPlayer.paused) {
                audioPlayer.play();
            } else {
                audioPlayer.pause();
            }
        } else {
            // Если кликнули по совершенно новому треку
            playTrack(album.tracks[index], index, album.tracks, album.artist);
        }
    }
});

if (repeatBtn) {
    repeatBtn.addEventListener('click', () => {
        // Меняем режим по кругу: 0 -> 1 -> 2 -> 0
        repeatMode = (repeatMode + 1) % 3;

        // Сбрасываем классы состояний, оставляя базовый класс
        repeatBtn.className = 'repeat-icon';

        // Включаем нужный класс в зависимости от режима
        if (repeatMode === 0) {
            repeatBtn.classList.add('repeat-off');
        } else if (repeatMode === 1) {
            repeatBtn.classList.add('repeat-track');
        } else if (repeatMode === 2) {
            repeatBtn.classList.add('repeat-album');
        }
    });
}

function getItemsPerPageLimit() {
    // Если ширина экрана меньше 768px (мобилка) — возвращаем 14, иначе для ПК — 18
    return window.innerWidth < 768 ? 14 : 18;
}

// Старт
window.onload = init;
