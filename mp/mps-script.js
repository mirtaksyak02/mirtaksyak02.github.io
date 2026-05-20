// Функция для загрузки списка треков
async function loadPlaylist() {
    try {
        // Запрашиваем файл из корня вашего сайта github.io
        const response = await fetch('./tracks.json');
        const tracks = await response.json();
        
        // Находим контейнер на странице, куда вставим треки
        const playlistContainer = document.getElementById('playlist');
        
        // Перебираем треки и создаем HTML-элементы
        tracks.forEach(track => {
            const trackElement = document.createElement('div');
            trackElement.className = 'track-item';
            trackElement.innerHTML = `
                <img src="${track.cover}" alt="${track.title}" width="50">
                <div class="track-info">
                    <h3>${track.title}</h3>
                    <p>${track.artist} — ${track.duration}</p>
                </div>
                <button onclick="playTrack('${track.url}')">▶ Воспроизвести</button>
            `;
            playlistContainer.appendChild(trackElement);
        });
    } catch (error) {
        console.error('Ошибка загрузки плейлиста:', error);
    }
}

// Простейшая функция для запуска аудио
const audioPlayer = new Audio();
function playTrack(url) {
    audioPlayer.src = url;
    audioPlayer.play();
}

// Запускаем загрузку при старте страницы
window.onload = loadPlaylist;
