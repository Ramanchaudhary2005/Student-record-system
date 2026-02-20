#include <iostream>
#include <vector>
#include <unordered_map>
#include <stack>
#include <algorithm>
using namespace std;

struct Student {
    int roll;
    string name;
    int dsa, os, dbms, cn;
    int totalFee, feePaid, feeLeft;
    int total;
    double percentage;
};

class StudentSystem {
private:
    vector<Student> students;
    unordered_map<int, int> rollIndex;

    stack<vector<Student>> undoStack;
    stack<vector<Student>> redoStack;

    void calculate(Student &s) {
        s.total = s.dsa + s.os + s.dbms + s.cn;
        s.percentage = s.total / 4.0;
        s.totalFee = max(0, s.totalFee);
        s.feePaid = max(0, s.feePaid);
        if (s.feePaid > s.totalFee) s.feePaid = s.totalFee;
        s.feeLeft = s.totalFee - s.feePaid;
    }

    void rebuildIndex() {
        rollIndex.clear();
        for (int i = 0; i < static_cast<int>(students.size()); i++)
            rollIndex[students[i].roll] = i;
    }

    void saveState() {
        undoStack.push(students);
        while (!redoStack.empty()) redoStack.pop();
    }

public:
    // Add Student
    void addStudent(Student s) {
        if (rollIndex.count(s.roll)) {
            cout << "Roll already exists\n";
            return;
        }
        saveState();
        calculate(s);
        students.push_back(s);
        rebuildIndex();
    }

    // Linear Search
    int linearSearch(int roll) {
        for (int i = 0; i < static_cast<int>(students.size()); i++)
            if (students[i].roll == roll)
                return i;
        return -1;
    }

    // Binary Search (after sorting by roll)
    int binarySearch(int roll) {
        sort(students.begin(), students.end(),
             [](Student a, Student b) {
                 return a.roll < b.roll;
             });

        int left = 0, right = static_cast<int>(students.size()) - 1;

        while (left <= right) {
            int mid = left + (right - left) / 2;

            if (students[mid].roll == roll)
                return mid;
            else if (students[mid].roll < roll)
                left = mid + 1;
            else
                right = mid - 1;
        }
        return -1;
    }

    // ----------- MERGE SORT (by total marks) -----------

    void merge(vector<Student> &arr, int l, int m, int r) {
        int n1 = m - l + 1;
        int n2 = r - m;

        vector<Student> L(n1), R(n2);

        for (int i = 0; i < n1; i++)
            L[i] = arr[l + i];
        for (int j = 0; j < n2; j++)
            R[j] = arr[m + 1 + j];

        int i = 0, j = 0, k = l;

        while (i < n1 && j < n2) {
            if (L[i].total >= R[j].total)
                arr[k++] = L[i++];
            else
                arr[k++] = R[j++];
        }

        while (i < n1)
            arr[k++] = L[i++];

        while (j < n2)
            arr[k++] = R[j++];
    }

    void mergeSort(vector<Student> &arr, int l, int r) {
        if (l < r) {
            int m = l + (r - l) / 2;
            mergeSort(arr, l, m);
            mergeSort(arr, m + 1, r);
            merge(arr, l, m, r);
        }
    }

    void sortByMarks() {
        if (students.empty()) return;
        saveState();
        mergeSort(students, 0, static_cast<int>(students.size()) - 1);
        rebuildIndex();
    }

    // ----------- MANUAL MAX HEAP -----------

    void heapify(vector<Student> &arr, int n, int i) {
        int largest = i;
        int left = 2 * i + 1;
        int right = 2 * i + 2;

        if (left < n && arr[left].total > arr[largest].total)
            largest = left;

        if (right < n && arr[right].total > arr[largest].total)
            largest = right;

        if (largest != i) {
            swap(arr[i], arr[largest]);
            heapify(arr, n, largest);
        }
    }

    void buildHeap(vector<Student> &arr) {
        for (int i = static_cast<int>(arr.size()) / 2 - 1; i >= 0; i--)
            heapify(arr, static_cast<int>(arr.size()), i);
    }

    vector<Student> topK(int k) {
        vector<Student> heap = students;
        buildHeap(heap);

        vector<Student> result;
        for (int i = static_cast<int>(heap.size()) - 1; i >= static_cast<int>(heap.size()) - k && i >= 0; i--) {
            swap(heap[0], heap[i]);
            result.push_back(heap[i]);
            heapify(heap, i, 0);
        }
        return result;
    }

    // Undo
    void undo() {
        if (undoStack.empty()) {
            cout << "Nothing to undo\n";
            return;
        }
        redoStack.push(students);
        students = undoStack.top();
        undoStack.pop();
        rebuildIndex();
    }

    // Redo
    void redo() {
        if (redoStack.empty()) {
            cout << "Nothing to redo\n";
            return;
        }
        undoStack.push(students);
        students = redoStack.top();
        redoStack.pop();
        rebuildIndex();
    }

    void display() {
        for (auto &s : students)
            cout << s.roll << " "
                 << s.name << " "
                 << s.total << " "
                 << s.percentage << "% "
                 << "| Fee Paid: " << s.feePaid
                 << " | Fee Left: " << s.feeLeft
                 << " | Status: " << (s.feeLeft == 0 ? "Paid" : "Unpaid") << "\n";
    }

    void feeReport() {
        cout << "\nFee Report:\n";
        for (auto &s : students)
            cout << "Roll " << s.roll
                 << " (" << s.name << ") "
                 << "Paid: " << s.feePaid
                 << ", Left: " << s.feeLeft
                 << ", " << (s.feeLeft == 0 ? "Paid" : "Unpaid") << "\n";
    }

    void complexityInfo() {
        cout << "\nTime Complexities:\n";
        cout << "Linear Search: O(n)\n";
        cout << "Binary Search: O(log n)\n";
        cout << "Merge Sort: O(n log n)\n";
        cout << "Heap Top-K: O(n log k)\n";
        cout << "HashMap Search: O(1) average\n";
    }
};

int main() {
    StudentSystem system;

    system.addStudent({101, "Aman", 92, 88, 95, 90, 50000, 50000, 0, 0, 0.0});
    system.addStudent({102, "Priya", 85, 91, 89, 93, 50000, 35000, 0, 0, 0.0});
    system.addStudent({103, "Rohit", 96, 90, 92, 94, 50000, 20000, 0, 0, 0.0});

    cout << "Initial Records:\n";
    system.display();
    system.feeReport();

    cout << "\nSorted by Marks (Merge Sort):\n";
    system.sortByMarks();
    system.display();

    cout << "\nTop 2 Students (Heap):\n";
    for (auto &s : system.topK(2))
        cout << s.name << " " << s.total << endl;

    system.complexityInfo();

    return 0;
}
