let albumsData = []; // Данные из JSON
let currentAlbumTracks = []; // Список треков альбома, который сейчас играет
let currentTrackIndex = -1;  // Индекс песни, которая играет в данный момент
let marqueeTimeout = null;   // Хранилище для таймера бегущей строки
let savedScrollPosition = 0; // Переменная для сохранения позиции прокрутки главной страницы
let navigationHistory = [];
let loadedImagesCache = new Set(); // Глобальный набор для хранения URL-адресов загруженных картинок

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

// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// Исправленный авто-конвертер ссылок
function getDirectLink(url) {
    if (url.includes('drive.google.com')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) return `https://google.com{match[1]}`;
    }
    if (url.includes('disk.yandex.ru') || url.includes('yadi.sk')) {
        return `https://yandex.net{encodeURIComponent(url)}`;
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
        const albumIdFromUrl = urlParams.get('album');
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
    
    // Если история пуста, кнопка при возврате выведет на главную
    if (navigationHistory.length === 0) {
        backBtn.textContent = '← Назад к альбомам';
        return;
    }
    
    // Смотрим на самый последний элемент в массиве истории (но не удаляем его из стека!)
    const nextBackPage = navigationHistory[navigationHistory.length - 1];
    
    if (nextBackPage.screen === 'main') {
        backBtn.textContent = '← Назад к альбомам';
    } 
    else if (nextBackPage.screen === 'album') {
        backBtn.textContent = '← Назад к релизу';
    } 
    else if (nextBackPage.screen === 'artist') {
        backBtn.textContent = '← Назад к артисту';
    }
}

// Добавьте параметр isBackMode в объявление функции
function showAlbumsGrid(isBackMode = false) {
    // Если мы вернулись кнопкой Назад, используем сохраненный скролл, иначе обнуляем
    const targetScroll = isBackMode ? savedScrollPosition : 0;
    
    setTimeout(() => { 
        window.scrollTo({ top: targetScroll, behavior: 'instant' }); 
    }, 0);

    if (!isBackMode) {
        navigationHistory = []; // Очищаем историю при выходе на главную с нуля
    }
    // Очищаем URL-параметры при возврате на главную
    window.history.pushState({}, '', window.location.pathname);
    
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

    // Отрисовываем только отфильтрованные релизы
    filteredAlbums.forEach(album => {
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
        
        const isMainCached = loadedImagesCache.has(album.cover);
        const mainLoadedClass = isMainCached ? 'is-loaded' : '';

        albumCard.innerHTML = `
            <div class="album-card-img-wrapper">
                <img src="${album.cover}" alt="${album.title}" class="${mainLoadedClass}" loading="lazy" decoding="async" onload="onImageLoad(this)">
            </div>
            <span class="grid-badge badge-${album.type}">${releaseTypesRu[album.type] || album.type}</span>
            <h3>${album.title} ${tagHtml}</h3>
            <p>${album.artist}</p>
            <p>${album.year}</p>
        `;
        contentArea.appendChild(albumCard);
    });
}

// 4. ЭКРАН ТРЕКОВ АЛЬБОМА
function openAlbum(albumId, isBackMode = false) {
    const currentScroll = window.scrollY || document.documentElement.scrollTop;
    
    // КРИТИЧЕСКИ ВАЖНО: Если это новый переход, а не возврат кнопкой Назад
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
            navigationHistory.push({ screen: 'main', id: null, scroll: currentScroll });
        }
    }

    // Твой оригинальный скролл наверх без анимации
    window.scrollTo({ top: 0, behavior: 'instant' });
    
    const album = albumsData.find(a => a.id === albumId);
    if (!album) return;
    
    // Дописываем ?album=ID_АЛЬБОМА в адресную строку браузера
    const newUrl = `${window.location.pathname}?album=${albumId}`;
    window.history.pushState({ albumId: albumId }, '', newUrl);
    
    pageTitle.style.display = 'none';
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
    
    const isLargeCoverCached = loadedImagesCache.has(album.cover);
    const largeLoadedClass = isLargeCoverCached ? 'is-loaded' : '';

    albumHeader.innerHTML = `
        <div class="album-large-cover-wrapper">
            <img src="${album.cover}" alt="${album.title}" class="album-large-cover ${largeLoadedClass}" loading="lazy" decoding="async" onload="onImageLoad(this)">
        </div>
        <div class="album-info-text">
            <span class="badge badge-${album.type}">${releaseTypesRu[album.type] || album.type}</span>
            <h2 class="album-title-header">${album.title} ${tagHtml}</h2>
            <p class="meta">
                <span class="artist-link" onclick="openArtistProfile('${album.artist.replace(/'/g, "\\'")}')">${album.artist}</span> 
                • ${album.year} • ${album.genre}
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
        
        // Корректный значок при отрисовке списка
        if (currentAlbumTracks === album.tracks && currentTrackIndex === index && !audioPlayer.paused) {
            playButton.textContent = '❙❙';
        } else {
            playButton.textContent = '▶';
        }
        
        playButton.addEventListener('click', () => {
            // Если кликнули по треку, который УЖЕ выбран
            if (currentAlbumTracks === album.tracks && currentTrackIndex === index) {
                if (audioPlayer.paused) {
                    audioPlayer.play();
                } else {
                    audioPlayer.pause();
                }
            } else {
                // Если кликнули по совершенно новому треку
                playTrack(track, index, album.tracks, album.artist);
            }
        });

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
    currentTrackIndex = index;

    const directUrl = getDirectLink(track.url);
    audioPlayer.src = directUrl;
    audioPlayer.play();
    
    masterPlayBtn.textContent = '❙❙'; 
    nowPlayingText.textContent = `${artistName} - ${track.title}`;

    const container = document.querySelector('.now-playing-container');
    
    // СБРОС: Очищаем таймеры, сбрасываем стили и классы
    clearTimeout(marqueeTimeout);
    nowPlayingText.removeAttribute('style');
    nowPlayingText.classList.remove('is-long');

    // Проверяем, нужно ли запускать прокрутку
    if (nowPlayingText.scrollWidth > container.offsetWidth) {
        
        // Ждем 2 секунды, пока текст стоит по центру (благодаря margin: 0 auto)
        marqueeTimeout = setTimeout(() => {
            
            // Текст длинный: отключаем авто-центрирование, прижимая строку к левому краю
            nowPlayingText.classList.add('is-long');
            
            const scrollDistance = nowPlayingText.scrollWidth - container.offsetWidth;
            const speed = 30; 
            const duration = scrollDistance * speed; 

            function startMarqueeLoop() {
                // 1. Возвращаем в начальную левую точку без анимации
                nowPlayingText.style.transition = 'none';
                nowPlayingText.style.transform = 'translateX(0)';
                
                setTimeout(() => {
                    // 2. Плавно катим текст влево до самого конца строки
                    nowPlayingText.style.transition = `transform ${duration}ms linear`;
                    nowPlayingText.style.transform = `translateX(-${scrollDistance}px)`;
                }, 50);

                // 3. Ждем окончания поездки, замираем на 2 секунды и повторяем
                marqueeTimeout = setTimeout(() => {
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
    const nextIndex = currentTrackIndex + 1;
    
    if (nextIndex < currentAlbumTracks.length) {
        const nextTrack = currentAlbumTracks[nextIndex];
        
        // Если у трека есть сохраненный автор (из перемешанного списка), берем его. 
        // Если нет — ищем стандартным способом через альбомы.
        const artistName = nextTrack.albumArtist || 
                           albumsData.find(a => a.tracks.includes(nextTrack))?.artist || 
                           "Исполнитель";
                           
        playTrack(nextTrack, nextIndex, currentAlbumTracks, artistName);
    } else {
        // Альбом полностью завершился сам:
        // Меняем иконку на панели на "Плей" (▶)
        masterPlayBtn.textContent = '▶';
        
        // Просто оставляем текущий индекс равным длине массива (сигнал, что мы в конце)
        currentTrackIndex = currentAlbumTracks.length; 
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
        if (currentTrackIndex > 0) {
            const prevIndex = currentTrackIndex - 1;
            const prevTrack = currentAlbumTracks[prevIndex];
            const artistName = prevTrack.albumArtist || albumsData.find(a => a.tracks.includes(prevTrack))?.artist || "Исполнитель";
            playTrack(prevTrack, prevIndex, currentAlbumTracks, artistName);
            updateTrackListIcons(); 
        }
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
            showAlbumsGrid(true); // Возврат на главную сетку
        } 
        else if (previousPage.screen === 'album') {
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
    showAlbumsGrid(); // Просто перерисовываем сетку с учетом нового фильтра
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
    const albumId = urlParams.get('album');
    
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
        const currentAlbumId = urlParams.get('album');
        if (currentAlbumId) {
            navigationHistory.push({ screen: 'album', id: currentAlbumId, scroll: currentScroll });
        }
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
    
    // ОБНОВЛЕНИЕ URL: Меняем ?album= на ?artist= в строке браузера
    const newUrl = `${window.location.pathname}?artist=${encodeURIComponent(artistName)}`;
    window.history.pushState({ artistName: artistName }, '', newUrl);
    
    pageTitle.style.display = 'none';
    searchContainer.style.setProperty('display', 'none', 'important');
    backBtn.style.display = 'block';
    albumHeader.style.display = 'none'; 

    updateBackButtonText();
    
    const artistReleases = albumsData.filter(album => album.artist.toLowerCase() === artistName.toLowerCase());
    if (artistReleases.length === 0) return;
    
    artistReleases.sort((a, b) => parseInt(b.year) - parseInt(a.year));
    
    // ФИКС ОПЕЧАТКИ: Считываем обложку из первого элемента отсортированного массива
    const latestCover = artistReleases[0].cover;
    
    contentArea.className = 'artist-profile-view';
    contentArea.innerHTML = '';

    // Генерируем красивую шапку артиста с бэкграунд-баннером
    const artistHeaderHtml = `
        <div class="artist-banner-zone" style="background-image: linear-gradient(to bottom, rgba(18,18,18,0.4), #121212), url('${latestCover}');">
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

    // Проверяем, есть ли уже эта обложка в нашем кэше памяти
    const isCached = loadedImagesCache.has(album.cover);
    // Если картинка в кэше — сразу даем ей класс четкости, иначе оставляем пустую строку
    const loadedClass = isCached ? 'is-loaded' : '';

    return `
        <div class="album-card" onclick="openAlbum('${album.id}')">
            <div class="album-card-img-wrapper">
                <!-- Функция onImageLoad запишет URL в память при первом успешном скачивании -->
                <img src="${album.cover}" alt="${album.title}" class="${loadedClass}" loading="lazy" decoding="async" onload="onImageLoad(this)">
            </div>
            <span class="grid-badge badge-${album.type}">${releaseTypesRu[album.type] || album.type}</span>
            <h3>${album.title} ${tagHtml}</h3>
            <p>${album.year}</p>
        </div>
    `;
}

// Функция, которая вызывается в момент onload абсолютно любой обложки на сайте
function onImageLoad(imgElement) {
    if (!imgElement) return;
    
    // Добавляем класс плавного появления/фокусировки
    imgElement.classList.add('is-loaded');
    
    // Намертво запоминаем URL этой картинки в кэш-список оперативной памяти плеера
    if (imgElement.src) {
        loadedImagesCache.add(imgElement.src);
    }
}

// Старт
window.onload = init;
