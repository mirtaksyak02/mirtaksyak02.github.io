let albumsData = []; // Данные из JSON
let currentAlbumTracks = []; // Список треков альбома, который сейчас играет
let currentTrackIndex = -1;  // Индекс песни, которая играет в данный момент
let marqueeTimeout = null;   // Хранилище для таймера бегущей строки

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
        
        // Проверяем, есть ли в URL параметр альбома
        const urlParams = new URLSearchParams(window.location.search);
        const albumIdFromUrl = urlParams.get('album');

        // Если параметр есть, и такой альбом существует в базе — открываем его
        if (albumIdFromUrl && albumsData.some(a => a.id === albumIdFromUrl)) {
            openAlbum(albumIdFromUrl);
        } else {
            // Иначе просто показываем главную страницу
            showAlbumsGrid(); 
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

function showAlbumsGrid() {
    // Обнуление позиции прокрутки
    setTimeout(() => { window.scrollTo(0, 0); }, 50);
    
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
        albumCard.innerHTML = `
            <img src="${album.cover}" alt="${album.title}">
            <span class="grid-badge badge-${album.type}">${releaseTypesRu[album.type] || album.type}</span>
            <h3>${album.title} ${tagHtml}</h3>
            <p>${album.artist}</p>
            <p>${album.year}</p>
        `;
        contentArea.appendChild(albumCard);
    });
}

// 4. ЭКРАН ТРЕКОВ АЛЬБОМА
function openAlbum(albumId) {
    setTimeout(() => { window.scrollTo(0, 0); }, 50);
    
    const album = albumsData.find(a => a.id === albumId);
    if (!album) return;
    
    // Дописываем ?album=ID_АЛЬБОМА в адресную строку браузера
    const newUrl = `${window.location.pathname}?album=${albumId}`;
    window.history.pushState({ albumId: albumId }, '', newUrl);
    
    pageTitle.style.display = 'none';
    searchContainer.style.setProperty('display', 'none', 'important');
    backBtn.style.display = 'block';
    albumHeader.style.display = 'flex';
    
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
    
    albumHeader.innerHTML = `
        <img src="${album.cover}" alt="${album.title}" class="album-large-cover">
        <div class="album-info-text">
            <span class="badge badge-${album.type}">${releaseTypesRu[album.type] || album.type}</span>
            <!-- Добавляем тег сразу после большого названия релиза -->
            <h2 class="album-title-header">${album.title} ${tagHtml}</h2>
            <p class="meta">${album.artist} • ${album.year} • ${album.genre}</p>
        </div>
    `;

    contentArea.className = 'tracks-list';
    contentArea.innerHTML = '';
    
   //Наполняем внутренний HTML строки (БЕЗ кнопки внутри текста)
   album.tracks.forEach((track, index) => {
        const trackRow = document.createElement('div');
        trackRow.className = 'track-item';
        
        // КРИТИЧЕСКИ ВАЖНО: привязываем ID трека к строчке HTML
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
masterPlayBtn.addEventListener('click', () => {
    if (currentAlbumTracks.length === 0 || currentTrackIndex === -1) return; 
    
    // ПРОВЕРКА: Если альбом доиграл до конца и мы нажимаем Плей
    if (currentTrackIndex === currentAlbumTracks.length) {
        // Сбрасываем индекс на самый первый трек
        const firstTrack = currentAlbumTracks[0];
        const artistName = albumsData.find(a => a.tracks.includes(firstTrack))?.artist || "Исполнитель";
        
        // Запускаем первую песню заново
        playTrack(firstTrack, 0, currentAlbumTracks, artistName);
        return; // Выходим из функции, так как playTrack сам всё включит
    }

    // Обычная логика Плей / Пауза в процессе прослушивания
    if (audioPlayer.paused) {
        audioPlayer.play();
        masterPlayBtn.textContent = '❙❙'; 
    } else {
        audioPlayer.pause();
        masterPlayBtn.textContent = '▶'; 
    }
    updateTrackListIcons();
});

nextBtn.addEventListener('click', () => {
    // Проверяем, есть ли вообще следующий трек в списке
    if (currentAlbumTracks.length > 0 && currentTrackIndex !== -1) {
        const nextIndex = currentTrackIndex + 1;

        // Переключаем, только если индекс не выходит за пределы массива
        if (nextIndex < currentAlbumTracks.length) {
            const nextTrack = currentAlbumTracks[nextIndex];
            
            // Берем имя артиста из самого трека или из альбома
            const artistName = nextTrack.albumArtist || 
                               albumsData.find(a => a.tracks.includes(nextTrack))?.artist || 
                               "Исполнитель";
                               
            playTrack(nextTrack, nextIndex, currentAlbumTracks, artistName);

            // Принудительно обновляем иконки в списке
            updateTrackListIcons(); 
        }
    }
});

prevBtn.addEventListener('click', () => {
    if (currentTrackIndex > 0) {
        const prevIndex = currentTrackIndex - 1;
        const prevTrack = currentAlbumTracks[prevIndex];
        
        // Берем имя артиста из самого трека или из альбома
        const artistName = prevTrack.albumArtist || 
                           albumsData.find(a => a.tracks.includes(prevTrack))?.artist || 
                           "Исполнитель";
                           
        playTrack(prevTrack, prevIndex, currentAlbumTracks, artistName);4

        // Принудительно обновляем иконки в списке
        updateTrackListIcons(); 
    }
});

// Автопереключение при окончании песни
audioPlayer.addEventListener('ended', () => {
    playNextTrack();
    updateTrackListIcons();
});

// Обновление таймлайна в процессе воспроизведения
audioPlayer.addEventListener('timeupdate', () => {
    if (audioPlayer.duration) {
        const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressBar.value = progress;
        currentTimeText.textContent = formatTime(audioPlayer.currentTime);
        progressBar.style.background = `linear-gradient(to bottom, transparent 5px, #71ffa3 5px, #1db954 ${progress}%, #404040 ${progress}%, #404040 8px, transparent 8px) no-repeat`;
        progressBar.style.backgroundSize = '100% 100%';
    
    }
});

// Получение длины трека после его загрузки
audioPlayer.addEventListener('loadedmetadata', () => {
    totalTimeText.textContent = formatTime(audioPlayer.duration);
    progressBar.style.background = `linear-gradient(to bottom, transparent 5px, #71ffa3 5px, #1db954 0%, #404040 0%, #404040 8px, transparent 8px) no-repeat`;
});

// ПОЛНОСТЬЮ ДОПИСАННЫЙ ХВОСТ КОДА:
// Перемотка трека вручную ползунком
progressBar.addEventListener('input', () => {
    if (audioPlayer.duration) {
        const timeToSet = (progressBar.value / 100) * audioPlayer.duration;
        audioPlayer.currentTime = timeToSet;
    }
});

// Управление громкостью плеера
audioPlayer.volume = volumeBar.value / 100;
volumeBar.addEventListener('input', () => {
    audioPlayer.volume = volumeBar.value / 100;
});

// Автоматически обновлять иконки в списке при любом старте музыки
audioPlayer.addEventListener('play', () => {
    masterPlayBtn.textContent = '❙❙'; // Меняем главную кнопку
    updateTrackListIcons();           // Меняем кнопку в списке треков
});

// Автоматически обновлять иконки в списке при любой остановке музыки
audioPlayer.addEventListener('pause', () => {
    masterPlayBtn.textContent = '▶';  // Меняем главную кнопку
    updateTrackListIcons();           // Меняем кнопку в списке треков
});

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

// Запуск приложения
window.onload = init;
