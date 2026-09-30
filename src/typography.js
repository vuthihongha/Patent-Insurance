// Keep Vietnamese compound words on one line ("bảo hiểm", "sáng chế", …) so headings
// never break as "Bảo / hiểm". Spaces inside these phrases become non-breaking spaces.
const NBSP = ' ';

const VI_PHRASES = [
  'hệ sinh thái', 'đổi mới sáng tạo', 'tự đánh giá', 'Hồ Chí Minh', 'vùng lãnh thổ', 'tài sản trí tuệ',
  'sở hữu trí tuệ', 'khoa học', 'công nghệ',
  'bảo hiểm', 'sáng chế', 'chiến lược', 'đổi mới', 'sáng tạo', 'thương mại', 'Việt Nam', 'pháp lý',
  'pháp luật', 'thị trường', 'doanh nghiệp', 'giai đoạn', 'sở hữu', 'trí tuệ', 'tài sản', 'chuyên gia',
  'quốc tế', 'kinh nghiệm', 'Hà Nội', 'Trung Quốc', 'Hoa Kỳ', 'Nhật Bản', 'châu Âu', 'nghiên cứu',
  'văn bằng', 'chi phí', 'rủi ro', 'Nhà nước', 'thí điểm', 'dự án', 'đề tài', 'hình thành', 'trụ cột',
  'lộ trình', 'phân tán', 'chuyển giao', 'khoảng trống', 'lấp đầy', 'mô hình', 'bài học', 'ứng dụng',
  'xâm phạm', 'thực thi', 'cốt lõi', 'chính sách', 'thực trạng', 'kiến nghị', 'lý luận', 'cơ sở',
  'hành trình', 'giới thiệu', 'thuật ngữ', 'văn bản', 'từ điển', 'phù hợp', 'khả thi', 'kiểm chứng',
  'chuẩn mực', 'lĩnh vực', 'nguyên nhân', 'mục tiêu', 'trao đổi', 'nhóm nghiên cứu', 'tổ chức', 'trung gian',
  'tài chính', 'thế giới', 'vòng đời', 'thông thường', 'bắt buộc', 'tự nguyện', 'kiểm soát', 'chủ thể',
  'công cụ', 'trang chủ', 'tham quan', 'hoạt động', 'quy định', 'hỗ trợ', 'định giá', 'thế chấp', 'bồi thường', 'tranh chấp', 'hợp đồng', 'phát triển', 'thông tin', 'tiếp cận', 'thúc đẩy', 'giải pháp', 'hiện nay', 'năng lực', 'dữ liệu', 'tham gia', 'khởi kiện', 'kiện tụng', 'luật sư', 'ngân sách', 'địa phương', 'câu hỏi', 'trả lời', 'nội dung', 'đánh giá', 'tiêu chí', 'sản phẩm', 'nhận thức', 'nhu cầu', 'điều kiện', 'cơ chế', 'hạ tầng', 'giám sát', 'đối tượng', 'triển khai', 'trách nhiệm', 'bảo hộ', 'cấp phép', 'cấp bằng', 'đăng ký', 'tác giả', 'hướng dẫn', 'đại học', 'sinh viên', 'khám phá', 'hệ thống', 'quản lý', 'cộng đồng', 'kết quả', 'phân tích', 'kỷ nguyên', 'vươn mình', 'chia sẻ', 'khơi thông', 'dòng chảy', 'yên tâm', 'gánh vác', 'miễn phí', 'ẩn danh', 'song ngữ', 'tiếng Việt', 'tiếng Anh', 'xem thêm', 'lĩnh hội', 'thời gian', 'giá trị', 'khai thác', 'bên thứ ba', 'mở rộng', 'nâng cao', 'xây dựng', 'hoàn thiện', 'ngành nghề', 'vốn vay', 'khoản vay', 'cơ quan', 'Chính phủ', 'Quốc hội', 'Nghị định', 'Thông tư', 'Bộ luật'
].sort((a, b) => b.length - a.length);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp(`(^|[^\\p{L}])(${VI_PHRASES.map(escape).join('|')})(?=$|[^\\p{L}])`, 'giu');

function keepPhrases(text) {
  return text.replace(pattern, (m, pre, phrase) => pre + phrase.replace(/ /g, NBSP));
}

// Apply to every string in a content object (Vietnamese only).
function applyNbsp(value) {
  if (typeof value === 'string') return keepPhrases(value);
  if (Array.isArray(value)) return value.map(applyNbsp);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach((k) => { out[k] = applyNbsp(value[k]); });
    return out;
  }
  return value;
}

module.exports = { applyNbsp };
