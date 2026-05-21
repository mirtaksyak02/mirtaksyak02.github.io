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
        showAlbumsGrid(); // Показываем сетку альбомов
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

function showAlbumsGrid() {
    // Обнуление позиции прокрутки для Android
    setTimeout(() => { window.scrollTo(0, 0); }, 50);
    
    backBtn.style.display = 'none';
    albumHeader.style.display = 'none';
    pageTitle.style.display = 'block';
    pageTitle.textContent = 'RARETENOR'; 
    
    contentArea.className = 'albums-grid'; 
    contentArea.innerHTML = '';

    albumsData.forEach(album => {
        const albumCard = document.createElement('div');
        albumCard.className = 'album-card';
        albumCard.onclick = () => openAlbum(album.id); 
        albumCard.innerHTML = `
            <img src="${album.cover}" alt="${album.title}">
            <span class="grid-badge badge-${album.type}">${releaseTypesRu[album.type] || album.type}</span>
            <h3>${album.title}</h3>
            <p>${album.artist}</p>
        `;
        contentArea.appendChild(albumCard);
    });
}

// 4. ЭКРАН ТРЕКОВ АЛЬБОМА
function openAlbum(albumId) {
    setTimeout(() => { window.scrollTo(0, 0); }, 50);
    
    const album = albumsData.find(a => a.id === albumId);
    if (!album) return;

    pageTitle.style.display = 'none';
    backBtn.style.display = 'block';
    albumHeader.style.display = 'flex';
    
    albumHeader.innerHTML = `
        <img src="${album.cover}" alt="${album.title}" class="album-large-cover">
        <div class="album-info-text">
            <span class="badge badge-${album.type}">${releaseTypesRu[album.type] || album.type}</span>
            <h2>${album.title}</h2>
            <p class="meta">${album.artist} • ${album.year} • ${album.genre}</p>
        </div>
    `;

    contentArea.className = 'tracks-list';
    contentArea.innerHTML = '';

    album.tracks.forEach((track, index) => {
        const trackRow = document.createElement('div');
        trackRow.className = 'track-item';
        
        trackRow.innerHTML = `
            <span class="track-number">${index + 1}</span>
            <div class="track-info">
                <h3>${track.title}</h3>
                <p>${album.artist}</p>
            </div>
            <span class="track-duration">${track.duration}</span>
        `;
        
        const playButton = document.createElement('button');
        playButton.className = 'play-btn';
        playButton.textContent = '▶';
        
        playButton.addEventListener('click', () => {
            playTrack(track, index, album.tracks, album.artist);
        });
        
        trackRow.appendChild(playButton);
        contentArea.appendChild(trackRow);
    });
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
} 

function playNextTrack() {
    if (currentAlbumTracks.length === 0 || currentTrackIndex === -1) return;

    const nextIndex = currentTrackIndex + 1;

    if (nextIndex < currentAlbumTracks.length) {
        const artistName = albumsData.find(a => a.tracks.includes(currentAlbumTracks[nextIndex]))?.artist || "Исполнитель";
        playTrack(currentAlbumTracks[nextIndex], nextIndex, currentAlbumTracks, artistName);
    } else {
        // Альбом полностью завершился сам:
        // 1. Меняем иконку на панели на "Плей" (▶)
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
});

nextBtn.addEventListener('click', () => {
    // Проверяем, есть ли вообще следующий трек в списке
    if (currentAlbumTracks.length > 0 && currentTrackIndex !== -1) {
        const nextIndex = currentTrackIndex + 1;

        // Переключаем, только если индекс не выходит за пределы массива
        if (nextIndex < currentAlbumTracks.length) {
            const artistName = albumsData.find(a => a.tracks.includes(currentAlbumTracks[nextIndex]))?.artist || "Исполнитель";
            playTrack(currentAlbumTracks[nextIndex], nextIndex, currentAlbumTracks, artistName);
        }
    }
});

prevBtn.addEventListener('click', () => {
    if (currentTrackIndex > 0) {
        const prevIndex = currentTrackIndex - 1;
        const artistName = albumsData.find(a => a.tracks.includes(currentAlbumTracks[prevIndex]))?.artist || "Исполнитель";
        playTrack(currentAlbumTracks[prevIndex], prevIndex, currentAlbumTracks, artistName);
    }
});

// Автопереключение при окончании песни
audioPlayer.addEventListener('ended', playNextTrack);

// Обновление таймлайна в процессе воспроизведения
audioPlayer.addEventListener('timeupdate', () => {
    if (audioPlayer.duration) {
        const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressBar.value = progress;
        currentTimeText.textContent = formatTime(audioPlayer.currentTime);
    }
});

// Получение длины трека после его загрузки
audioPlayer.addEventListener('loadedmetadata', () => {
    totalTimeText.textContent = formatTime(audioPlayer.duration);
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

// Запуск приложения
window.onload = init;
