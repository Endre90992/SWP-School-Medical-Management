import React, { useEffect, useState } from "react";
import { Button, Input, Table, message, Modal, Form, Select, Typography, Avatar, Tag, DatePicker } from "antd";
import { SearchOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { Edit2, Trash2 } from "lucide-react";
import Sidebar from "../../components/sb-Manager/Sidebar";
import style from "../../assets/css/userList.module.css";  // Import CSS riêng cho UserList
import axios from "axios";
import Notification from "../../components/Notification";
import { notifySuccess, notifyError } from "../../utils/notification";
import LoadingOverlay from "../../components/LoadingOverlay";

const { Option } = Select;
const { Title } = Typography;

const apiUrl = "/api/User";

const UsersList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // 'add' or 'edit'
  const [editingUser, setEditingUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1); // Trạng thái trang hiện tại
  const [modalForm] = Form.useForm();
  const usersPerPage = 10; // Số清單 mỗi trang
  const [studentModalVisible, setStudentModalVisible] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [studentForm] = Form.useForm();

  // Fetch users from API
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      // Nếu API trả về { data: [...] } thì lấy response.data.data
      const userArr = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data.data)
        ? response.data.data
        : [];
      // Lọc bỏ user đã bị soft delete (isActive === false)
      const activeUsers = userArr.filter((u) => u.isActive !== false);
      setUsers(activeUsers);
      setLoading(false);
    } catch (err) {
      message.error("Failed to fetch users");
      console.error("Fetch users error:", err, err?.response?.data);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(); // Fetch users when the component is mounted
  }, []);

  // Filter users by search text
  const filteredUsers = users.filter(
    (user) =>
      user.isActive !== false && // Ẩn user đã bị soft delete
      (user.fullName.toLowerCase().includes(searchText.toLowerCase()) ||
        user.email.toLowerCase().includes(searchText.toLowerCase()) ||
        user.phone.includes(searchText))
  );

  // Pagination handler
  const handlePageChange = (page) => {
    setCurrentPage(page); // Cập nhật trang hiện tại khi chuyển trang
  };

  // Hiển thị modal thêm/sửa清單
const showModal = (mode, user = null) => {
  setModalMode(mode);
  setEditingUser(user);
  if (mode === "edit" && user) {
    modalForm.setFieldsValue({
      ...user,
      roleId: user.role?.roleId || user.roleId, // Set đúng roleId nếu có
    });
  } else {
    modalForm.resetFields(); // Reset form khi mở modal thêm mới
  }
  setModalVisible(true); // Mở modal
};

  // Đóng modal
  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingUser(null);
    modalForm.resetFields();
  };

  // 停用清單 qua API (soft delete)
  const handleDelete = async (userId) => {
    let id = userId;
    if (!id) {
      id = localStorage.getItem("userId");
    }
    if (!id) {
      notifyError("找不到使用者 ID。");
      return;
    }
    // Tìm user object từ danh sách users
    const userToDelete = users.find(u => u.userID === id || u.userId === id);
    if (!userToDelete) {
      notifyError("找不到要刪除的使用者資料。");
      return;
    }
    Modal.confirm({
      title: "確定要停用這個使用者嗎？",
      icon: <ExclamationCircleOutlined />,
      onOk: async () => {
        try {
          const token = localStorage.getItem("token");
          const realId = typeof id === "string" ? id.trim() : id;
          // Chuẩn bị payload đầy đủ cho API update
          const payload = {
            userID: userToDelete.userID || userToDelete.userId,
            fullName: userToDelete.fullName,
            roleID: userToDelete.role?.roleId || userToDelete.roleID || userToDelete.roleId,
            phone: userToDelete.phone,
            email: userToDelete.email,
            address: userToDelete.address,
            isActive: false,
          };
          await axios.put(`${apiUrl}/${realId}`, payload, {
            headers: { Authorization: `Bearer ${token}` },
          });
          notifySuccess("使用者已停用");
          fetchUsers(); // Cập nhật lại danh sách
        } catch (err) {
          if (err.response && err.response.data && err.response.data.message) {
            notifyError("停用使用者失敗：" + err.response.data.message);
          } else {
            notifyError("停用使用者失敗。");
          }
        }
      },
    });
  };

  // Xử lý submit form modal
const handleModalSubmit = async (values) => {
  try {
    const token = localStorage.getItem("token");
    // Lấy đúng userId từ editingUser (API trả về userId, không phải userID)
    let userID = editingUser?.userId || editingUser?.userID;
    if (modalMode === "add") {
      // 新增清單 mới
      const dataToSend = {
        username: values.username,
        password: values.password,
        fullName: values.fullName,
        roleID: Number(values.roleId), 
        phone: values.phone,
        email: values.email,
        address: values.address,
        isActive: true,
        isFirstLogin: true,
      };
      await axios.post(apiUrl, dataToSend, {
        headers: { Authorization: `Bearer ${token}` },
      });
      notifySuccess("使用者新增成功");
    } else if (modalMode === "edit" && editingUser) {
      // Cập nhật清單
      const editData = {
        userID: userID, // Đúng tên trường
        fullName: values.fullName,
        roleID: Number(values.roleId),
        phone: values.phone,
        email: values.email,
        address: values.address,
        isActive: true,
      };
      if (!userID) {
        notifyError("找不到要更新的使用者 ID。");
        return;
      }
      await axios.put(`${apiUrl}/${userID}`, editData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      notifySuccess("使用者更新成功");
    }
    fetchUsers();
    setModalVisible(false);
  } catch (error) {
  console.error("儲存名單失敗:", error);
  const errorMessage = error?.response?.data?.message || "儲存使用者失敗。";
  
  // Kiểm tra thông điệp từ backend
  if (errorMessage.includes("Username already exists")) {
    notifyError("此登入帳號已存在，請更換帳號名稱。");
  } else {
    notifyError(errorMessage);
  }
}
};

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // 新增 hàm handleAddStudent
  const handleAddStudent = (parent) => {
    setSelectedParent(parent);
    studentForm.resetFields(); // Reset form khi mở modal
    setStudentModalVisible(true);
  };

  const handleStudentSubmit = async (values) => {
    try {
      const token = localStorage.getItem("token");
      
      if (!token) {
        message.error("找不到登入憑證，請重新登入。");
        return;
      }
      
      // Kiểm tra parentId
      const parentId = selectedParent?.userID || selectedParent?.userId;
      if (!parentId) {
        message.error("找不到家長 ID。");
        return;
      }
      
      // Đảm bảo genderId là số
      const genderId = typeof values.genderId === 'string' 
        ? parseInt(values.genderId, 10) 
        : values.genderId;
      
      // Định dạng payload theo đúng yêu cầu của API
      const payload = {
        fullName: values.fullName.trim(),
        dateOfBirth: values.dateOfBirth.format("YYYY-MM-DD"),
        genderId: genderId,
        class: values.className.trim(),
        parentId: parentId
      };
      
      console.log("Sending payload:", JSON.stringify(payload));
      
      // Sử dụng URL tuyệt đối vì đang trên production
      const apiUrl = "http://127.0.0.1:5080/api/Student";
      
      const response = await axios.post(
        apiUrl,
        payload,
        { 
          headers: { 
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );
      
      console.log("Response:", response.data);
      message.success("學生新增成功。");
      setStudentModalVisible(false);
    } catch (error) {
      console.error("Lỗi khi thêm học sinh:", error);
      
      // Kiểm tra lỗi xác thực
      if (error.response && error.response.status === 401) {
        message.error("登入已逾時，請重新登入。");
        setTimeout(() => {
          localStorage.clear();
          window.location.href = "/login";
        }, 2000);
        return;
      }
      
      if (error.response) {
        console.log("Response status:", error.response.status);
        console.log("Response data:", JSON.stringify(error.response.data));
        
        const errorMsg = error.response.data?.message || 
                         error.response.data?.title || 
                         error.response.statusText || 
                         "未知錯誤";
        message.error(`新增學生失敗：${errorMsg}`);
      } else if (error.request) {
        console.log("Request error:", error.request);
        message.error("本機後端沒有回應，請確認 EduHealth 後端已啟動。");
      } else {
        message.error("錯誤：" + error.message);
      }
    }
  };

  return (
    <div className={style.layoutContainer}>
      <Notification />
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      <main className={style.layoutContent}>
        <header className={style.dashboardHeaderBar}>
          <div className={style.titleGroup}>
            <h1>
              <span className={style.textBlack}>使用者</span>
              <span className={style.textAccent}>清單</span>
            </h1>
          </div>
        </header>

        <div className={style.header}>
          <input
            type="text"
            placeholder="Tìm kiếm清單..."
            className={style.searchBar}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <button className={style.addBtn} onClick={() => showModal("add")}>新增清單</button>
        </div>

        <table className={style.studentTable}>
          <thead>
            <tr>
              <th>STT</th>
              <th>姓名</th>
              <th>Email</th>
              <th>電話</th>
              <th>地址</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Hiệu ứng skeleton loading khi đang tải dữ liệu
              Array.from({ length: 8 }).map((_, idx) => (
                <tr key={idx} className={style.skeletonRow}>
                  {Array.from({ length: 6 }).map((_, cidx) => (
                    <td key={cidx}><div className={style.skeletonCell}></div></td>
                  ))}
                </tr>
              ))
            ) : filteredUsers.length > 0 ? (
              filteredUsers.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage).map((user, index) => {
                const realUserId = user.userID;
                return (
                  <tr key={realUserId || index}>
                    <td>{(currentPage - 1) * usersPerPage + index + 1}</td>
                    <td>{user.fullName}</td>
                    <td>{user.email}</td>
                    <td>{user.phone}</td>
                    <td>{user.address}</td>
                    <td>
                      <div className={style.actionGroup}>
                        <button className={style.editBtn} onClick={() => showModal("edit", user)}>
                          <Edit2 size={16} /> 編輯
                        </button>
                        <button className={style.deleteBtn} onClick={() => handleDelete(realUserId)}>
                          <Trash2 size={16} /> 停用
                        </button>
                        {user.roleName === "Parent" ? (
                          <button className={style.addStudentBtn} onClick={() => handleAddStudent(user)}>
                            + 新增學生
                          </button>
                        ) : (
                          <span className={style.addStudentBtn} style={{ visibility: "hidden" }}>+ 新增學生</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: "center" }}>
                  目前沒有名單資料
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className={style.pagination}>
          {[...Array(Math.ceil(filteredUsers.length / usersPerPage))].map((_, index) => (
            <button
              key={index}
              onClick={() => handlePageChange(index + 1)}
              className={currentPage === index + 1 ? style.activePage : ""}
            >
              {index + 1}
            </button>
          ))}
        </div>

        {/* Modal thêm/sửa清單 */}
        <Modal
  open={modalVisible}
  title={modalMode === "add" ? "新增清單" : "Chỉnh sửa清單"}
  onCancel={handleModalCancel}
  onOk={() => modalForm.submit()}  // Khi nhấn 儲存 hoặc 新增 sẽ gọi submit form
  okText={modalMode === "add" ? "新增" : "儲存"}
>
  <Form form={modalForm} layout="vertical" onFinish={handleModalSubmit}>
    <Form.Item name="fullName" label="姓名" rules={[{ required: true, message: "請輸入姓名" }]}>
      <Input />
    </Form.Item>
    <Form.Item name="email" label="Email" rules={[{ required: true, message: "請輸入 Email" }, { type: "email", message: "Email 格式不正確" }]}>
      <Input />
    </Form.Item>
    <Form.Item name="phone" label="電話">
      <Input />
    </Form.Item>
    <Form.Item name="address" label="地址" rules={[{ required: true, message: "請輸入地址" }]}>
      <Input />
    </Form.Item>
    <Form.Item name="roleId" label="角色" rules={[{ required: true, message: "請選擇角色" }]}> 
      <Select> 
        <Option value={1}>Manager</Option> 
        <Option value={2}>Nurse</Option> 
        <Option value={3}>Parent</Option> 
      </Select> 
    </Form.Item>
    {modalMode === "add" && (
      <>
        <Form.Item name="username" label="登入帳號" rules={[{ required: true, message: "請輸入登入帳號" }]}> 
          <Input /> 
        </Form.Item>
        <Form.Item
          name="password"
          label="密碼"
          rules={[
            { required: true, message: "請輸入密碼" },
            { min: 6, message: "密碼 phải có ít nhất 6 ký tự" }
          ]} 
        > 
          <Input.Password /> 
        </Form.Item>
      </>
    )}
  </Form>
</Modal>
      </main>
      {loading && <LoadingOverlay text="資料載入中..." />}
      {/* Modal thêm học sinh đặt ngoài cùng */}
      <Modal
        open={studentModalVisible}
        title="新增 học sinh cho phụ huynh"
        onCancel={() => setStudentModalVisible(false)}
        onOk={() => studentForm.submit()}
        okText="新增"
      >
        <Form
          form={studentForm}
          layout="vertical"
          onFinish={handleStudentSubmit}
          validateTrigger="onChange"
        >
          <Form.Item
            name="fullName"
            label="學生姓名"
            rules={[{ required: true, message: "請輸入學生姓名" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="dateOfBirth"
            label="出生日期"
            rules={[{ required: true, message: "請選擇出生日期" }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="genderId"
            label="性別"
            rules={[{ required: true, message: "請選擇性別" }]}
          >
            <Select>
              <Option value={0}>Nam</Option>
              <Option value={1}>男</Option>\n              <Option value={2}>女</Option>\n              <Option value={3}>其他／未填</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="className"
            label="班級"
            rules={[{ required: true, message: "請輸入班級" }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersList;